"""
bom_planner.py — R3 #9 (PRD §5.10) outbound BOM + accessory planning, run by ATP.

For a BOM order line (after the serial ATP has found the terminals):
  1. Components needed = qty per BOM unit x line qty, at the line's fulfilling warehouse.
  2. Free stock there (on hand - other orders' reservations) covers what it can.
  3. Shortfall -> search other warehouses/FSLs (same region first, then transit time)
     and auto-draft a Distribution Order (status Draft) per source warehouse. These are
     the line's "Component Transfer Orders"; the Supply Planner reviews and issues them.
  4. Anything still missing -> COMPONENT_SHORTAGE alert.
  5. bom_assembly_status: COMPLETE (all on hand) | PARTIAL (rest covered by transfer DS)
     | PENDING (something not found anywhere).
  6. EDD = max(terminal EDD, component arrival + transit to destination)
           + longest component assembly lead time.
Reservations for the order (and for each drafted DS at its source) are then rebuilt, so
the stock is held. Re-running ATP drops the whole previous plan first (reset_plan: unpeg,
release, cancel draft transfer DS). It is refused once the order is allocated or one of
its transfer DS has been issued (atp_rerun_blocker) — agreed with Jakub 2026-09-23.

A plain non-serialised order line (e.g. a component DS) is "ATP'd" against free stock at
the order's fulfilling location — no serial search.

Two kinds of BOM product:
  * serialised parent + accessory components (V400M = terminal + cable): the parent's own
    serials are found by the normal ATP; components are reserved accessories.
  * KIT — a BOM with a serialised component (V400-Kit = V400M + cable): the kit has no
    serials of its own. ATP searches each serialised component instead (run_kit_atp) and
    pegs those terminals to the order; the kitting warehouse is the order's Fulfilling
    Location if set, else where ATP found the first of them. Terminals pegged at another
    warehouse are moved there by a transfer DS (pegged to the DS while in transit, handed
    back to the order when it is delivered), the same way as missing accessories.
"""
import json
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from accessory_stock import (
    assembly_days, bom_components, free, raise_component_shortage, release_order,
    sync_order_reservations,
)
from models import NonSerialisedInventory, OrderNumbering, OutboundOrder, OutboundOrderLine, SerialNumber

STOCK_LOCATION_TYPES = ("Warehouse", "FSL")
OPEN_DS_STATUSES = ("Issued", "Allocated", "Shipped", "Delivered")


def kit_serial_components(db: Session, product_id: int):
    """Serialised components of a BOM product — non-empty means the product is a kit."""
    return [c for c in bom_components(db, product_id) if c.component and c.component.serialised]


_ATP_RANK = {"ATP_OK": 0, "ATP_PARTIAL": 1, "ATP_NONE": 2}


def run_kit_atp(db: Session, order: OutboundOrder, line: OutboundOrderLine, ctx, destination_id, kit_comps):
    """ATP for a kit line: run the normal serial search per serialised component and merge.
    Returns an ATPResult for the line (pegged serials are the component terminals)."""
    from atp_engine import ATPResult, run_atp_check
    merged = ATPResult()
    merged.status = "ATP_OK"
    merged.fulfilling_qty = line.quantity
    merged.reasoning.append(f"Kit {line.product.code}: no own serials — searching serialised components")
    for comp in kit_comps:
        per_kit = comp.quantity or 1
        proxy = SimpleNamespace(product_id=comp.component_product_id,
                                quantity=per_kit * line.quantity, product=comp.component)
        r = run_atp_check(db, order, proxy, ctx, destination_id)
        merged.pegged_serial_ids += r.pegged_serial_ids
        merged.fulfilling_location_id = merged.fulfilling_location_id or r.fulfilling_location_id
        merged.fulfilling_qty = min(merged.fulfilling_qty, r.fulfilling_qty // per_kit)  # complete kits covered
        merged.pegged_po_id = merged.pegged_po_id or r.pegged_po_id
        if r.edd and (not merged.edd or r.edd > merged.edd):
            merged.edd = r.edd
        if _ATP_RANK.get(r.status, 2) > _ATP_RANK[merged.status]:
            merged.status = r.status
        merged.split_details += [dict(d, product_code=comp.component.code) for d in r.split_details]
        merged.reasoning += [f"  [{comp.component.code}] {x}" for x in r.reasoning]
    return merged


def _unpeg_order(db: Session, order_id: int):
    for s in db.query(SerialNumber).filter(SerialNumber.pegged_to_order_id == order_id):
        s.pegged_to_order_id = None


def cancel_draft_transfer(db: Session, ds: OutboundOrder):
    ds.status = "Cancelled"
    release_order(db, ds.id)
    _unpeg_order(db, ds.id)  # terminals held for a kit transfer go back to the pool


def atp_rerun_blocker(db: Session, order: OutboundOrder) -> Optional[str]:
    """Why ATP may not be re-run on this order, or None. Re-running drops the whole plan,
    so it is only allowed before allocation and while its transfer DS are still drafts."""
    if order.status not in ("Draft", "Issued"):
        return f"Order is {order.status} — ATP can only be re-run on Draft or Issued orders"
    for line in order.lines:
        for ds in db.query(OutboundOrder).filter(OutboundOrder.id.in_(transfer_ds_ids(line))):
            if ds.status not in ("Draft", "Cancelled"):
                return f"Transfer {ds.order_number} created by ATP is already {ds.status} — ATP can't be re-run"
    return None


def reset_plan(db: Session, order: OutboundOrder):
    """Drop the previous ATP plan: unpeg the order's terminals, release its reservations,
    cancel its draft transfer DS and clear the per-line ATP/BOM fields."""
    _unpeg_order(db, order.id)
    release_order(db, order.id)
    for line in order.lines:
        for ds in db.query(OutboundOrder).filter(OutboundOrder.id.in_(transfer_ds_ids(line)), OutboundOrder.status == "Draft"):
            cancel_draft_transfer(db, ds)
        line.component_transfer_orders = None
        line.bom_assembly_status = None
        line.atp_status = None
        line.atp_reasoning = None
        line.atp_split_details = None
        line.edd = None
        line.fulfilling_location_id = None
    db.flush()


def _iso(d: date) -> str:
    return d.isoformat()


def _next_ds_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "DistributionOrder").first()
    if not row:
        return "DS000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


def transfer_ds_ids(line: OutboundOrderLine) -> List[int]:
    try:
        return [int(x) for x in json.loads(line.component_transfer_orders or "[]")]
    except (ValueError, TypeError):
        return []


def _region_of(ctx, loc_id: int) -> Optional[int]:
    for region_id, ids in ctx.locations_by_region.items():
        if loc_id in ids:
            return region_id
    return None


def _source_candidates(db: Session, ctx, product_id: int, warehouse_id: int) -> List[int]:
    """Other warehouses/FSLs holding the product: same region first, then shortest transit."""
    loc_ids = {
        r.location_id for r in db.query(NonSerialisedInventory.location_id).filter(
            NonSerialisedInventory.product_id == product_id, NonSerialisedInventory.quantity > 0,
        )
    }
    wh_region = _region_of(ctx, warehouse_id)
    cands = []
    for lid in loc_ids:
        loc = ctx.locations.get(lid)
        if lid == warehouse_id or not loc or not loc.location_type or loc.location_type.name not in STOCK_LOCATION_TYPES:
            continue
        cands.append((0 if _region_of(ctx, lid) == wh_region else 1, ctx.get_transit_days(lid, warehouse_id), lid))
    return [lid for _, _, lid in sorted(cands)]


def _draft_transfer_ds(db: Session, parent: OutboundOrder, line: OutboundOrderLine,
                       product_id: int, source_id: int, warehouse_id: int, qty: int) -> OutboundOrder:
    ds = OutboundOrder(
        order_number=_next_ds_number(db),
        order_type="Distribution",
        status="Draft",
        fulfilling_location_id=source_id,
        destination_location_id=warehouse_id,
        created_by_user_id=parent.created_by_user_id,
    )
    db.add(ds)
    db.flush()
    ds_line = OutboundOrderLine(order_id=ds.id, line_number=1, product_id=product_id, quantity=qty,
                                fulfilling_location_id=source_id, atp_status="ATP_OK")
    db.add(ds_line)
    db.flush()
    ds_line.atp_reasoning = (
        f"Component transfer for {parent.order_number} line {line.line_number} (BOM auto-draft)"
    )
    db.refresh(ds)
    sync_order_reservations(db, ds)  # hold the stock at the source warehouse
    return ds


def plan_accessory_line(db: Session, order: OutboundOrder, line: OutboundOrderLine, ctx):
    loc = order.fulfilling_location_id
    line.fulfilling_location_id = loc
    if not loc:
        line.atp_status, line.atp_reasoning = "ATP_NONE", "No fulfilling location set for accessory line"
        return
    avail = free(db, line.product_id, loc, exclude_order_id=order.id)
    line.atp_status = "ATP_OK" if avail >= line.quantity else ("ATP_PARTIAL" if avail > 0 else "ATP_NONE")
    dest = order.destination_location_id or loc
    line.edd = _iso(date.today() + timedelta(days=ctx.get_transit_days(loc, dest)))
    line.atp_reasoning = f"Accessory: {avail} free at {ctx.locations[loc].code if loc in ctx.locations else loc}, need {line.quantity}"


def plan_bom_line(db: Session, order: OutboundOrder, line: OutboundOrderLine, ctx,
                  taken: Dict[Tuple[int, int], int]) -> List[str]:
    """Plan components for one BOM line. `taken` tracks stock already claimed by earlier
    lines of this order during this run. Returns reasoning lines."""
    reasoning = []
    comps = bom_components(db, line.product_id)
    if not comps:
        line.bom_assembly_status = "COMPLETE"
        return ["BOM: no components configured"]

    is_kit = any(c.component and c.component.serialised for c in comps)
    if is_kit and order.fulfilling_location_id:
        # A kit is assembled where the order says; terminals ATP found elsewhere are
        # moved there on a transfer DS below
        warehouse = order.fulfilling_location_id
    else:
        warehouse = line.fulfilling_location_id or order.fulfilling_location_id
    if not warehouse:
        line.bom_assembly_status = "PENDING"
        return ["BOM: no fulfilling warehouse — components not planned"]
    line.fulfilling_location_id = warehouse
    wh_code = ctx.locations[warehouse].code if warehouse in ctx.locations else str(warehouse)

    # Previous plan: keep transfer DS already in flight, cancel Drafts (they are redrafted)
    kept_incoming: Dict[int, int] = {}
    kept_ids = []
    for ds in db.query(OutboundOrder).filter(OutboundOrder.id.in_(transfer_ds_ids(line))).all():
        if ds.status in OPEN_DS_STATUSES and ds.destination_location_id != warehouse:
            reasoning.append(f"BOM: {ds.order_number} goes to another warehouse — not counted")
            continue
        if ds.status in OPEN_DS_STATUSES:
            kept_ids.append(ds.id)
            for dl in ds.lines:
                kept_incoming[dl.product_id] = kept_incoming.get(dl.product_id, 0) + dl.quantity
        elif ds.status == "Draft":
            cancel_draft_transfer(db, ds)
            reasoning.append(f"BOM: cancelled previous draft transfer {ds.order_number}")
    db.flush()

    new_ds: List[OutboundOrder] = []
    uncovered = False
    arrival = date.today()
    available_state = ctx.available_state_ids[0]
    for comp in comps:
        pid = comp.component_product_id
        if comp.component and comp.component.serialised:
            # Kit terminal: ATP already pegged what it found. Terminals available at another
            # warehouse move to the kitting warehouse on a transfer DS (pegged to that DS).
            code = comp.component.code
            need = (comp.quantity or 1) * line.quantity
            pegged = db.query(SerialNumber).filter(
                SerialNumber.pegged_to_order_id == order.id, SerialNumber.product_id == pid).all()
            by_loc: Dict[int, List[SerialNumber]] = {}
            for sn in pegged:
                if sn.current_location_id != warehouse and sn.current_state_id == available_state:
                    by_loc.setdefault(sn.current_location_id, []).append(sn)
            for src, sns in by_loc.items():
                ds = _draft_transfer_ds(db, order, line, pid, src, warehouse, len(sns))
                for sn in sns:
                    sn.pegged_to_order_id = ds.id
                new_ds.append(ds)
                days = ctx.get_transit_days(src, warehouse)
                arrival = max(arrival, date.today() + timedelta(days=days))
                reasoning.append(f"BOM: drafted {ds.order_number} {len(sns)}x {code} {ctx.locations[src].code} -> {wh_code} ({days} days)")
            found = len(pegged) + kept_incoming.get(pid, 0)
            reasoning.append(f"BOM: {code} need {need}, pegged {len(pegged)}"
                             + (f", in transit {kept_incoming[pid]}" if kept_incoming.get(pid) else ""))
            if found < need:
                uncovered = True
                raise_component_shortage(db, order, pid, warehouse, need - found)
                reasoning.append(f"BOM: {need - found}x {code} not found — shortage alert raised")
            continue
        code = comp.component.code if comp.component else str(pid)
        need = (comp.quantity or 1) * line.quantity
        here = max(0, free(db, pid, warehouse, exclude_order_id=order.id) - taken.get((pid, warehouse), 0))
        use_here = min(need, here)
        taken[(pid, warehouse)] = taken.get((pid, warehouse), 0) + use_here
        short = need - use_here - kept_incoming.get(pid, 0)
        reasoning.append(f"BOM: {code} need {need}, free at {wh_code} {here}"
                         + (f", in transit {kept_incoming[pid]}" if kept_incoming.get(pid) else ""))
        for src in _source_candidates(db, ctx, pid, warehouse) if short > 0 else []:
            avail = max(0, free(db, pid, src) - taken.get((pid, src), 0))
            if avail <= 0:
                continue
            qty = min(short, avail)
            taken[(pid, src)] = taken.get((pid, src), 0) + qty
            ds = _draft_transfer_ds(db, order, line, pid, src, warehouse, qty)
            new_ds.append(ds)
            days = ctx.get_transit_days(src, warehouse)
            arrival = max(arrival, date.today() + timedelta(days=days))
            reasoning.append(f"BOM: drafted {ds.order_number} {qty}x {code} {ctx.locations[src].code} -> {wh_code} ({days} days)")
            short -= qty
            if short <= 0:
                break
        if short > 0:
            uncovered = True
            raise_component_shortage(db, order, pid, warehouse, short)
            reasoning.append(f"BOM: {short}x {code} not available anywhere — shortage alert raised")

    line.component_transfer_orders = json.dumps(kept_ids + [d.id for d in new_ds]) if (kept_ids or new_ds) else None
    if is_kit:
        line.atp_split_details = None  # sources are shown as transfer DS; the kit ships from `warehouse`
    if uncovered:
        line.bom_assembly_status = "PENDING"
    elif kept_ids or new_ds:
        line.bom_assembly_status = "PARTIAL"
    else:
        line.bom_assembly_status = "COMPLETE"

    asm = assembly_days(comps)
    dest = order.destination_location_id or warehouse
    comp_ready = arrival + timedelta(days=ctx.get_transit_days(warehouse, dest))
    base = date.fromisoformat(line.edd) if line.edd else comp_ready
    line.edd = _iso(max(base, comp_ready) + timedelta(days=asm))
    reasoning.append(f"BOM: status {line.bom_assembly_status}, assembly {asm} days, EDD {line.edd}")
    return reasoning


def plan_order(db: Session, order: OutboundOrder, ctx):
    """Run after the serial ATP for all lines: accessories + BOM components, then reservations."""
    taken: Dict[Tuple[int, int], int] = {}
    for line in order.lines:
        product = line.product
        if not product:
            continue
        if not product.serialised:
            plan_accessory_line(db, order, line, ctx)
        elif product.is_bom:
            extra = plan_bom_line(db, order, line, ctx, taken)
            line.atp_reasoning = "\n".join(filter(None, [line.atp_reasoning] + extra))
    db.flush()
    sync_order_reservations(db, order)


def refresh_after_transfer(db: Session, ds: OutboundOrder):
    """A component transfer DS was delivered: re-evaluate the BOM lines it feeds."""
    from atp_engine import ATPContext
    for line in db.query(OutboundOrderLine).filter(OutboundOrderLine.component_transfer_orders.isnot(None)).all():
        ids = transfer_ds_ids(line)
        if ds.id not in ids:
            continue
        # Kit terminals: the ones that actually travelled on the DS (whatever was
        # allocated to it) now belong to the parent order; leftover DS pegs are dropped
        for oos in ds.serials:
            if oos.serial and oos.serial.product_id != line.product_id:
                oos.serial.pegged_to_order_id = line.order_id
        for sn in db.query(SerialNumber).filter(SerialNumber.pegged_to_order_id == ds.id):
            sn.pegged_to_order_id = None
        if line.bom_assembly_status == "PENDING":
            continue
        dss = db.query(OutboundOrder).filter(OutboundOrder.id.in_(ids)).all()
        if all(d.status == "Delivered" for d in dss):
            order = line.order if hasattr(line, "order") and line.order else db.query(OutboundOrder).get(line.order_id)
            ctx = ATPContext(db, order.customer_id)
            warehouse = line.fulfilling_location_id or order.fulfilling_location_id
            dest = order.destination_location_id or warehouse
            line.bom_assembly_status = "COMPLETE"
            line.edd = _iso(date.today()
                            + timedelta(days=assembly_days(bom_components(db, line.product_id)))
                            + timedelta(days=ctx.get_transit_days(warehouse, dest)))
            edds = [l.edd for l in order.lines if l.edd]
            if edds:
                order.atp_delivery_date = max(edds)
