"""
accessory_stock.py — R3 #9: non-serialised stock (accessories / BOM components).

Accessories are counted per location in non_serialised_inventory (state "Available").
Orders reserve them via accessory_reservations instead of pegging serials:

    free(product, location) = on_hand(Available) - sum(Reserved reservations)

Lifecycle of a reservation: Reserved -> Consumed (order shipped) | Released
(order cancelled, or the BOM line re-planned by ATP).

Who reserves what (see sync_order_reservations):
  * a non-serialised order line (e.g. a component DS)  -> line qty of that product
  * a BOM order line                                   -> qty per BOM unit x line qty
                                                          of each component
  both at the line's fulfilling location (falling back to the order's).

Shipping consumes the order's own reservations. It is blocked outright if the stock
is not physically on hand (physical_shortages). If the stock it takes would leave less
on hand than other orders have reserved there, that is a reservation conflict: the ship
endpoint asks for confirmation first and raises RESERVATION_AT_RISK alerts.
"""
from datetime import datetime, timezone
from math import ceil
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    AccessoryReservation,
    Alert,
    AlertRule,
    NonSerialisedInventory,
    OutboundOrder,
    OutboundOrderLine,
    OutboundOrderNonSerial,
    Product,
    ProductBomComponent,
)

AVAILABLE = "Available"


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Stock figures
# ---------------------------------------------------------------------------

def on_hand(db: Session, product_id: int, location_id: int) -> int:
    return int(
        db.query(func.coalesce(func.sum(NonSerialisedInventory.quantity), 0))
        .filter(
            NonSerialisedInventory.product_id == product_id,
            NonSerialisedInventory.location_id == location_id,
            NonSerialisedInventory.state == AVAILABLE,
        )
        .scalar()
        or 0
    )


def reserved(db: Session, product_id: int, location_id: int, exclude_order_id: Optional[int] = None) -> int:
    q = db.query(func.coalesce(func.sum(AccessoryReservation.quantity), 0)).filter(
        AccessoryReservation.product_id == product_id,
        AccessoryReservation.location_id == location_id,
        AccessoryReservation.status == "Reserved",
    )
    if exclude_order_id is not None:
        q = q.filter(AccessoryReservation.order_id != exclude_order_id)
    return int(q.scalar() or 0)


def free(db: Session, product_id: int, location_id: int, exclude_order_id: Optional[int] = None) -> int:
    return max(0, on_hand(db, product_id, location_id) - reserved(db, product_id, location_id, exclude_order_id))


def stock_by_location(db: Session, product_id: int) -> List[dict]:
    """On hand / reserved / free for every location holding or reserving the product."""
    loc_ids = {
        r.location_id
        for r in db.query(NonSerialisedInventory.location_id).filter(NonSerialisedInventory.product_id == product_id)
    } | {
        r.location_id
        for r in db.query(AccessoryReservation.location_id).filter(
            AccessoryReservation.product_id == product_id, AccessoryReservation.status == "Reserved"
        )
    }
    out = []
    for lid in loc_ids:
        oh, rs = on_hand(db, product_id, lid), reserved(db, product_id, lid)
        out.append({"location_id": lid, "on_hand": oh, "reserved": rs, "free": max(0, oh - rs), "short": max(0, rs - oh)})
    return out


def _adjust_stock(db: Session, product_id: int, location_id: int, delta: int):
    row = (
        db.query(NonSerialisedInventory)
        .filter(
            NonSerialisedInventory.product_id == product_id,
            NonSerialisedInventory.location_id == location_id,
            NonSerialisedInventory.state == AVAILABLE,
        )
        .first()
    )
    if not row:
        row = NonSerialisedInventory(product_id=product_id, location_id=location_id, state=AVAILABLE, quantity=0)
        db.add(row)
    row.quantity = (row.quantity or 0) + delta
    row.updated_at = _now()


# ---------------------------------------------------------------------------
# BOM helpers
# ---------------------------------------------------------------------------

def bom_components(db: Session, product_id: int) -> List[ProductBomComponent]:
    return db.query(ProductBomComponent).filter(ProductBomComponent.parent_product_id == product_id).all()


def assembly_days(components: List[ProductBomComponent]) -> int:
    """Longest assembly lead time across the components, in whole days (agreed with Jakub)."""
    days = 0
    for c in components:
        v = c.assembly_leadtime_value or 0
        d = ceil(v / 24) if (c.assembly_leadtime_unit or "days").lower().startswith("hour") else v
        days = max(days, d)
    return days


def line_location(order: OutboundOrder, line: OutboundOrderLine) -> Optional[int]:
    return line.fulfilling_location_id or order.fulfilling_location_id


def required_components(db: Session, order: OutboundOrder) -> List[Tuple[OutboundOrderLine, int, int, int]]:
    """(line, product_id, location_id, qty) of non-serialised stock the order needs."""
    needs = []
    for line in order.lines:
        product = line.product or db.query(Product).get(line.product_id)
        loc = line_location(order, line)
        if not product or not loc:
            continue
        if not product.serialised:
            needs.append((line, product.id, loc, line.quantity))
        elif product.is_bom:
            for comp in bom_components(db, product.id):
                if comp.component and comp.component.serialised:
                    continue  # serialised components (kits) are pegged by ATP, not reserved
                needs.append((line, comp.component_product_id, loc, (comp.quantity or 1) * line.quantity))
    return needs


# ---------------------------------------------------------------------------
# Reservations
# ---------------------------------------------------------------------------

def release_order(db: Session, order_id: int):
    for r in db.query(AccessoryReservation).filter(
        AccessoryReservation.order_id == order_id, AccessoryReservation.status == "Reserved"
    ):
        r.status, r.closed_at = "Released", _now()


def reserve(db: Session, order: OutboundOrder, line: OutboundOrderLine, product_id: int, location_id: int, qty: int):
    """Reserve the full need, even beyond what is on hand now — a shortfall shows up as
    `short` in stock_by_location and is covered by component transfer DS / incoming POs."""
    if qty > 0:
        db.add(AccessoryReservation(
            order_id=order.id, order_line_id=line.id, product_id=product_id,
            location_id=location_id, quantity=qty, status="Reserved",
        ))


def sync_order_reservations(db: Session, order: OutboundOrder):
    """(Re)build the order's Reserved rows from its lines. Consumed rows are untouched."""
    release_order(db, order.id)
    db.flush()
    for line, product_id, loc, qty in required_components(db, order):
        reserve(db, order, line, product_id, loc, qty)
    db.flush()


def order_reservations(db: Session, order_id: int) -> List[AccessoryReservation]:
    return (
        db.query(AccessoryReservation)
        .filter(AccessoryReservation.order_id == order_id)
        .order_by(AccessoryReservation.id)
        .all()
    )


def incoming_transfers(db: Session, order_id: int) -> Dict[Tuple[int, int], List[Tuple[str, int]]]:
    """(product, location) -> [(DS number, qty)] still on the way on this order's component
    transfer DS (auto-drafted by ATP, not yet delivered/cancelled)."""
    from bom_planner import transfer_ds_ids
    order = db.query(OutboundOrder).get(order_id)
    out: Dict[Tuple[int, int], List[Tuple[str, int]]] = {}
    for line in order.lines if order else []:
        for ds in db.query(OutboundOrder).filter(OutboundOrder.id.in_(transfer_ds_ids(line))):
            if ds.status in ("Delivered", "Cancelled"):
                continue
            for dl in ds.lines:
                out.setdefault((dl.product_id, ds.destination_location_id), []).append((ds.order_number, dl.quantity))
    return out


def reservation_warnings(db: Session, order_id: int) -> List[dict]:
    """For each of the order's open reservations: is the location short, i.e. do all
    orders together reserve more than is on hand — and this order's own transfer DS
    don't cover the gap? (e.g. another shipment used the stock up)"""
    incoming = incoming_transfers(db, order_id)
    out = []
    for r in order_reservations(db, order_id):
        if r.status != "Reserved":
            continue
        oh, rs = on_hand(db, r.product_id, r.location_id), reserved(db, r.product_id, r.location_id)
        coming = sum(q for _, q in incoming.get((r.product_id, r.location_id), []))
        if oh + coming < rs:
            out.append({
                "product_code": r.product.code if r.product else None,
                "location_code": r.location.code if r.location else None,
                "reserved_for_this_order": r.quantity,
                "reserved_all_orders": rs,
                "on_hand": oh,
            })
    return out


# ---------------------------------------------------------------------------
# Shipping: conflicts + consumption; delivery of accessories on a DS
# ---------------------------------------------------------------------------

def physical_shortages(db: Session, order: OutboundOrder) -> List[str]:
    """Accessories this order needs that are not physically on hand — shipping is blocked
    (unlike ship_conflicts, which the user may confirm)."""
    need: Dict[Tuple[int, int], int] = {}
    for r in order_reservations(db, order.id):
        if r.status == "Reserved":
            need[(r.product_id, r.location_id)] = need.get((r.product_id, r.location_id), 0) + r.quantity
    out = []
    for (pid, lid), qty in need.items():
        oh = on_hand(db, pid, lid)
        if oh < qty:
            from models import Location
            product, loc = db.query(Product).get(pid), db.query(Location).get(lid)
            out.append(f"{qty}x {product.code if product else pid} needed at "
                       f"{loc.code if loc else lid}, only {max(oh, 0)} on hand")
    return out


def ship_conflicts(db: Session, order: OutboundOrder) -> List[dict]:
    """Stock this order would take that other orders have reserved at the same location."""
    taken: Dict[Tuple[int, int], int] = {}
    for r in order_reservations(db, order.id):
        if r.status == "Reserved":
            taken[(r.product_id, r.location_id)] = taken.get((r.product_id, r.location_id), 0) + r.quantity
    conflicts = []
    for (pid, lid), qty in taken.items():
        oh = on_hand(db, pid, lid)
        others = reserved(db, pid, lid, exclude_order_id=order.id)
        left_after = oh - qty
        if left_after < others:
            affected = (
                db.query(OutboundOrder.order_number)
                .join(AccessoryReservation, AccessoryReservation.order_id == OutboundOrder.id)
                .filter(
                    AccessoryReservation.product_id == pid,
                    AccessoryReservation.location_id == lid,
                    AccessoryReservation.status == "Reserved",
                    AccessoryReservation.order_id != order.id,
                )
                .distinct()
                .all()
            )
            product = db.query(Product).get(pid)
            from models import Location
            loc = db.query(Location).get(lid)
            conflicts.append({
                "product_id": pid,
                "product_code": product.code if product else None,
                "location_id": lid,
                "location_code": loc.code if loc else None,
                "on_hand": oh,
                "this_order_takes": qty,
                "reserved_by_other_orders": others,
                "shortfall_for_others": others - max(0, left_after),
                "affected_orders": [a.order_number for a in affected],
            })
    return conflicts


def consume_order(db: Session, order: OutboundOrder):
    """Ship: deduct the order's reserved stock and mark the reservations Consumed."""
    for r in order_reservations(db, order.id):
        if r.status != "Reserved":
            continue
        _adjust_stock(db, r.product_id, r.location_id, -r.quantity)
        db.add(OutboundOrderNonSerial(
            order_id=order.id, order_line_id=r.order_line_id, product_id=r.product_id, quantity=r.quantity,
        ))
        r.status, r.closed_at = "Consumed", _now()


def raise_at_risk_alerts(db: Session, shipping_order: OutboundOrder, conflicts: List[dict]):
    rule = db.query(AlertRule).filter(AlertRule.rule_code == "RESERVATION_AT_RISK").first()
    if not rule or not rule.enabled:
        return
    for c in conflicts:
        db.add(Alert(
            rule_id=rule.id, severity="Urgent", status="New",
            product_id=c["product_id"], location_id=c["location_id"],
            reference_id=shipping_order.id, reference_type="outbound_order",
            message=(
                f"{shipping_order.order_number} shipped {c['this_order_takes']}x {c['product_code']} from "
                f"{c['location_code']}; {c['shortfall_for_others']} reserved for "
                f"{', '.join(c['affected_orders'])} no longer on hand"
            ),
        ))


def receive_ds_accessories(db: Session, order: OutboundOrder):
    """Deliver a DS: add the accessories it shipped to the destination warehouse."""
    if not order.destination_location_id:
        return
    for ns in db.query(OutboundOrderNonSerial).filter(OutboundOrderNonSerial.order_id == order.id):
        _adjust_stock(db, ns.product_id, order.destination_location_id, ns.quantity or 0)


def raise_component_shortage(db: Session, order: OutboundOrder, product_id: int, location_id: int, missing: int):
    rule = db.query(AlertRule).filter(AlertRule.rule_code == "COMPONENT_SHORTAGE").first()
    if not rule or not rule.enabled:
        return
    product = db.query(Product).get(product_id)
    db.add(Alert(
        rule_id=rule.id, severity="Urgent", status="New",
        product_id=product_id, location_id=location_id,
        reference_id=order.id, reference_type="outbound_order",
        message=(
            f"Urgent inventory need: {missing}x {product.code if product else product_id} for BOM on "
            f"{order.order_number} — not available anywhere in the network"
        ),
    ))
