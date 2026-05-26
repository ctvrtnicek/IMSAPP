from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    Customer, DistributionOrder, OutboundOrder, Product,
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
):
    """Search all IMS objects. Returns exact and partial match sections."""
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
    serials = db.query(SerialNumber).filter(SerialNumber.serial_number.ilike(like)).limit(50).all()
    for s in serials:
        r = _hit("Terminal", s.serial_number, f"Product: {s.product.code if s.product else '—'} | State: {s.current_state.code if s.current_state else '—'}", f"/terminal/{s.id}")
        add(r, _exact(s.serial_number, term))

    # ── Purchase Orders ─────────────────────────────────────────────────────
    pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.po_number.ilike(like) | PurchaseOrder.external_reference.ilike(like)
    ).limit(30).all()
    for p in pos:
        r = _hit("Purchase Order", p.po_number, f"Supplier: {p.supplier.name if p.supplier else '—'} | Status: {p.status}", f"/po/{p.po_number}")
        add(r, _exact(p.po_number, term) or _exact(p.external_reference, term))

    # ── Outbound Orders (SO / RN / RP) ──────────────────────────────────────
    outbound = db.query(OutboundOrder).filter(
        OutboundOrder.order_type.in_(["Sales", "Rental", "Replacement"]),
        OutboundOrder.order_number.ilike(like),
    ).limit(30).all()
    for o in outbound:
        label = {"Sales": "Sales Order", "Rental": "Rental Order", "Replacement": "Replacement Order"}.get(o.order_type, o.order_type)
        r = _hit(label, o.order_number, f"Customer: {o.customer.name if o.customer else '—'} | Status: {o.status}", f"/order/{o.order_number}")
        add(r, _exact(o.order_number, term))

    # ── Distribution Orders ─────────────────────────────────────────────────
    dist = db.query(DistributionOrder).filter(DistributionOrder.order_number.ilike(like)).limit(20).all()
    for d in dist:
        r = _hit("Distribution Order", d.order_number, f"Status: {d.status}", f"/order/{d.order_number}")
        add(r, _exact(d.order_number, term))

    # ── Repair & Rework Orders ──────────────────────────────────────────────
    rr = db.query(RepairReworkOrder).filter(RepairReworkOrder.order_number.ilike(like)).limit(20).all()
    for r_ in rr:
        r = _hit("Repair & Rework Order", r_.order_number, f"Status: {r_.status} | Type: {r_.dispatch_type}", f"/repair/{r_.order_number}")
        add(r, _exact(r_.order_number, term))

    # ── Return Orders ───────────────────────────────────────────────────────
    ret = db.query(ReturnOrder).filter(ReturnOrder.order_number.ilike(like)).limit(20).all()
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
    customers = db.query(Customer).filter(
        Customer.name.ilike(like) | Customer.customer_ref.ilike(like)
    ).limit(20).all()
    for c in customers:
        r = _hit("Customer", c.customer_ref, c.name, f"/dashboard")
        add(r, _exact(c.customer_ref, term) or _exact(c.name, term))

    # ── Suppliers ───────────────────────────────────────────────────────────
    suppliers = db.query(Supplier).filter(
        Supplier.name.ilike(like) | Supplier.code.ilike(like)
    ).limit(20).all()
    for s in suppliers:
        r = _hit("Supplier", s.code, s.name, f"/dashboard")
        add(r, _exact(s.code, term) or _exact(s.name, term))

    return {"exact": exact, "partial": partial, "term": term}
