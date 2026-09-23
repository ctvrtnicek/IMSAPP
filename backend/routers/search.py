from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from scoping import Scope, get_scope
from models import (
    Customer, DistributionOrder, Firmware, OutboundOrder, Product,
    PurchaseOrder, RepairReworkOrder, ReturnOrder, SerialNumber, Supplier, User,
)

router = APIRouter(prefix="/api/search", tags=["search"])


def _exact(val: Optional[str], term: str) -> bool:
    return bool(val and val.lower() == term.lower())


def _partial(val: Optional[str], term: str) -> bool:
    return bool(val and term.lower() in val.lower())


def _hit(obj_type: str, identifier: str, description: str, url_path: str) -> dict:
    return {
        "object_type": obj_type,
        "identifier": identifier,
        "description": description,
        "url_path": url_path,
    }


@router.get("", response_model=dict)
def global_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    """Search all IMS objects the caller can see (scoping.py). Returns exact and partial match sections."""
    term = q.strip()
    if not term:
        return {"exact": [], "partial": []}

    exact: List[dict] = []
    partial: List[dict] = []
    seen: set = set()

    def add(result: dict, is_exact: bool):
        key = (result["object_type"], result["identifier"])
        if key in seen:
            return
        seen.add(key)
        if is_exact:
            exact.append(result)
        else:
            partial.append(result)

    like = f"%{term}%"

    # ── Serial Numbers ──────────────────────────────────────────────────────
    serials = scope.apply(db.query(SerialNumber), scope.serial_filter).filter(SerialNumber.serial_number.ilike(like)).limit(50).all()
    for s in serials:
        r = _hit("Terminal", s.serial_number, f"Product: {s.product.code if s.product else '—'} | State: {s.current_state.code if s.current_state else '—'}", f"/terminal/{s.id}")
        add(r, _exact(s.serial_number, term))

    # ── Purchase Orders ─────────────────────────────────────────────────────
    pos = scope.apply(db.query(PurchaseOrder), scope.po_filter).filter(
        PurchaseOrder.po_number.ilike(like) | PurchaseOrder.external_reference.ilike(like)
    ).limit(30).all()
    for p in pos:
        r = _hit("Purchase Order", p.po_number, f"Supplier: {p.supplier.name if p.supplier else '—'} | Status: {p.status}", f"/po/{p.po_number}")
        add(r, _exact(p.po_number, term) or _exact(p.external_reference, term))

    # ── Outbound Orders (SO / RN / RP) ──────────────────────────────────────
    outbound = scope.apply(db.query(OutboundOrder), scope.outbound_filter).filter(
        OutboundOrder.order_type.in_(["Sales", "Rental", "Replacement"]),
        OutboundOrder.order_number.ilike(like),
    ).limit(30).all()
    for o in outbound:
        label = {"Sales": "Sales Order", "Rental": "Rental Order", "Replacement": "Replacement Order"}.get(o.order_type, o.order_type)
        r = _hit(label, o.order_number, f"Customer: {o.customer.name if o.customer else '—'} | Status: {o.status}", f"/order/{o.order_number}")
        add(r, _exact(o.order_number, term))

    # ── Distribution Orders ─────────────────────────────────────────────────
    dist = scope.apply(db.query(DistributionOrder), lambda: or_(
        DistributionOrder.origin_location_id.in_(scope.location_ids),
        DistributionOrder.destination_location_id.in_(scope.location_ids),
    )).filter(DistributionOrder.order_number.ilike(like)).limit(20).all()
    for d in dist:
        r = _hit("Distribution Order", d.order_number, f"Status: {d.status}", f"/order/{d.order_number}")
        add(r, _exact(d.order_number, term))

    # ── Repair & Rework Orders ──────────────────────────────────────────────
    rr = scope.apply(db.query(RepairReworkOrder), scope.rr_filter).filter(RepairReworkOrder.order_number.ilike(like)).limit(20).all()
    for r_ in rr:
        r = _hit("Repair & Rework Order", r_.order_number, f"Status: {r_.status} | Type: {r_.dispatch_type}", f"/repair/{r_.order_number}")
        add(r, _exact(r_.order_number, term))

    # ── Return Orders ───────────────────────────────────────────────────────
    # Returns: No access for repair-centre / supplier-only users (Appendix A)
    roles = set(getattr(current_user, "roles_list", None) or [current_user.role])
    ret = [] if roles <= {"repair_centre", "supplier"} else scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.order_number.ilike(like)).limit(20).all()
    for r_ in ret:
        r = _hit("Return Order", r_.order_number, f"Reason: {r_.reason} | Status: {r_.status}", f"/return/{r_.order_number}")
        add(r, _exact(r_.order_number, term))

    # ── Products ────────────────────────────────────────────────────────────
    products = db.query(Product).filter(
        Product.code.ilike(like) | Product.name.ilike(like)
    ).limit(20).all()
    for p in products:
        r = _hit("Product", p.code, p.name, f"/dashboard")  # no dedicated product page
        add(r, _exact(p.code, term) or _exact(p.name, term))

    # ── Customers ───────────────────────────────────────────────────────────
    # Master data (customers, suppliers) is No Access for scoped roles — Appendix A
    customers = [] if not scope.unrestricted else db.query(Customer).filter(
        Customer.name.ilike(like) | Customer.customer_ref.ilike(like)
    ).limit(20).all()
    for c in customers:
        r = _hit("Customer", c.customer_ref, c.name, f"/dashboard")
        add(r, _exact(c.customer_ref, term) or _exact(c.name, term))

    # ── Firmware ────────────────────────────────────────────────────────────
    firmwares = db.query(Firmware).filter(
        Firmware.firmware_name.ilike(like) | Firmware.version.ilike(like)
    ).limit(20).all()
    for fw in firmwares:
        r = _hit("Firmware", fw.firmware_name, f"Version: {fw.version or '—'} | Release: {fw.release_date or '—'}", f"/dashboard")
        add(r, _exact(fw.firmware_name, term) or _exact(fw.version, term))

    # ── Suppliers ───────────────────────────────────────────────────────────
    suppliers = [] if not scope.unrestricted else db.query(Supplier).filter(
        Supplier.name.ilike(like) | Supplier.code.ilike(like)
    ).limit(20).all()
    for s in suppliers:
        r = _hit("Supplier", s.code, s.name, f"/dashboard")
        add(r, _exact(s.code, term) or _exact(s.name, term))

    return {"exact": exact, "partial": partial, "term": term}
