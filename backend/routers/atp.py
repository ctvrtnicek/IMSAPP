"""
ATP — Available to Promise API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    OutboundOrder, OutboundOrderLine, SerialNumber,
    CustomerSegment, ATPRule, Customer, User
)
from atp_engine import run_atp_for_order, get_alternative_products


def _require_planner_or_admin(user: User):
    roles = getattr(user, "roles_list", [user.role])
    if not any(r in ("admin", "supply_planner") for r in roles):
        raise HTTPException(status_code=403, detail="Admin or Supply Planner only")

router = APIRouter(prefix="/api/atp", tags=["atp"])


# ── Customer Segments CRUD ──────────────────────────────────────────────────

class SegmentCreate(BaseModel):
    segment_code: str
    segment_name: str
    priority: int = 99

class SegmentUpdate(BaseModel):
    segment_name: Optional[str] = None
    priority: Optional[int] = None

class SegmentOut(BaseModel):
    id: int
    segment_code: str
    segment_name: str
    priority: int
    model_config = {"from_attributes": True}


@router.get("/segments", response_model=List[SegmentOut])
def list_segments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(CustomerSegment).order_by(CustomerSegment.priority).all()


@router.post("/segments", response_model=SegmentOut, status_code=201)
def create_segment(payload: SegmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    if db.query(CustomerSegment).filter(CustomerSegment.segment_code == payload.segment_code).first():
        raise HTTPException(409, "Segment code already exists")
    seg = CustomerSegment(**payload.model_dump())
    db.add(seg); db.commit(); db.refresh(seg)
    return seg


@router.put("/segments/{seg_id}", response_model=SegmentOut)
def update_segment(seg_id: int, payload: SegmentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    seg = db.query(CustomerSegment).filter(CustomerSegment.id == seg_id).first()
    if not seg: raise HTTPException(404, "Segment not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(seg, k, v)
    db.commit(); db.refresh(seg)
    return seg


# ── ATP Rules CRUD ──────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    region_id: Optional[int] = None
    segment_id: Optional[int] = None
    rule_key: str
    rule_value: str
    description: Optional[str] = None

class RuleOut(BaseModel):
    id: int
    region_id: Optional[int] = None
    segment_id: Optional[int] = None
    rule_key: str
    rule_value: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


@router.get("/rules", response_model=List[RuleOut])
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ATPRule).order_by(ATPRule.id).all()


@router.post("/rules", response_model=RuleOut, status_code=201)
def create_rule(payload: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    rule = ATPRule(**payload.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    rule = db.query(ATPRule).filter(ATPRule.id == rule_id).first()
    if not rule: raise HTTPException(404, "Rule not found")
    db.delete(rule); db.commit()


# ── Run ATP ─────────────────────────────────────────────────────────────────

@router.post("/run/{order_id}")
def run_atp(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Trigger ATP check for an outbound order. Returns results per line."""
    _require_planner_or_admin(current_user)
    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    results = run_atp_for_order(db, order_id)

    return {
        "order_id": order_id,
        "atp_feasible": order.atp_feasible,
        "atp_delivery_date": order.atp_delivery_date,
        "lines": [
            {
                "line_id": lid,
                "atp_status": r.status,
                "fulfilling_location_id": r.fulfilling_location_id,
                "fulfilling_qty": r.fulfilling_qty,
                "pegged_serials": len(r.pegged_serial_ids),
                "edd": r.edd,
            }
            for lid, r in results.items()
        ]
    }


@router.post("/unpeg/{order_id}")
def unpeg_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Remove all serial pegging for an order (e.g., before reallocation)."""
    _require_planner_or_admin(current_user)
    serials = db.query(SerialNumber).filter(SerialNumber.pegged_to_order_id == order_id).all()
    for s in serials:
        s.pegged_to_order_id = None

    lines = db.query(OutboundOrderLine).filter(OutboundOrderLine.order_id == order_id).all()
    for l in lines:
        l.atp_status = None
        l.edd = None
        l.fulfilling_location_id = None

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if order:
        order.atp_feasible = None
        order.atp_delivery_date = None

    db.commit()
    return {"unpegged": len(serials)}


@router.get("/alternatives/{product_id}")
def list_alternatives(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get alternative products for ATP Step 6."""
    _require_planner_or_admin(current_user)
    from models import Product
    alt_ids = get_alternative_products(db, product_id)
    result = []
    for pid in alt_ids:
        p = db.query(Product).filter(Product.id == pid).first()
        if p:
            result.append({"id": p.id, "code": p.code, "name": p.name})
    return result


# ── Outbound Allocation ─────────────────────────────────────────────────────

@router.get("/allocation")
def get_allocation_view(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all unshipped outbound orders grouped by allocation status."""
    _require_planner_or_admin(current_user)
    orders = (
        db.query(OutboundOrder)
        .filter(OutboundOrder.status.notin_(["Shipped", "Delivered", "Cancelled", "Closed"]))
        .order_by(OutboundOrder.created_at.desc())
        .all()
    )

    allocated = []
    non_allocated = []

    for o in orders:
        pegged_count = db.query(SerialNumber).filter(SerialNumber.pegged_to_order_id == o.id).count()

        row = {
            "id": o.id,
            "order_number": o.order_number,
            "order_type": o.order_type,
            "status": o.status,
            "customer_name": o.customer.name if o.customer else None,
            "segment_name": o.customer.segment.segment_name if o.customer and o.customer.segment else None,
            "segment_priority": o.customer.segment.priority if o.customer and o.customer.segment else 99,
            "atp_feasible": o.atp_feasible,
            "atp_delivery_date": o.atp_delivery_date,
            "pegged_count": pegged_count,
            "allocation_source_order_id": o.allocation_source_order_id,
            "created_at": str(o.created_at) if o.created_at else None,
            "lines": [],
        }

        for line in o.lines:
            row["lines"].append({
                "id": line.id,
                "product_id": line.product_id,
                "product_code": line.product.code if line.product else None,
                "product_name": line.product.name if line.product else None,
                "quantity": line.quantity,
                "atp_status": line.atp_status,
                "edd": line.edd,
                "fulfilling_location_id": line.fulfilling_location_id,
                "fulfilling_location_code": line.fulfilling_location.code if line.fulfilling_location else None,
                "atp_split_details": __import__('json').loads(line.atp_split_details) if line.atp_split_details else None,
            })

        if pegged_count > 0:
            allocated.append(row)
        else:
            non_allocated.append(row)

    allocated.sort(key=lambda x: x["segment_priority"])
    non_allocated.sort(key=lambda x: x["segment_priority"])

    return {"allocated": allocated, "non_allocated": non_allocated}


class ReallocateRequest(BaseModel):
    target_order_id: int
    donor_order_id: int
    product_id: int
    quantity: int


@router.post("/reallocate")
def reallocate(payload: ReallocateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reallocate pegged inventory from donor order to target order."""
    _require_planner_or_admin(current_user)
    from models import SystemConfig

    config = db.query(SystemConfig).filter(SystemConfig.config_key == "ATP_REALLOCATION_LOOKBACK_DAYS").first()
    lookback_days = int(config.current_value) if config else 30

    target = db.query(OutboundOrder).filter(OutboundOrder.id == payload.target_order_id).first()
    donor = db.query(OutboundOrder).filter(OutboundOrder.id == payload.donor_order_id).first()

    if not target or not donor:
        raise HTTPException(404, "Order not found")
    if donor.status in ("Shipped", "Delivered", "Cancelled"):
        raise HTTPException(400, "Donor order is not eligible for reallocation")

    serials = (
        db.query(SerialNumber)
        .filter(
            SerialNumber.pegged_to_order_id == donor.id,
            SerialNumber.product_id == payload.product_id,
        )
        .limit(payload.quantity)
        .all()
    )

    moved = 0
    for s in serials:
        s.pegged_to_order_id = target.id
        moved += 1

    target.allocation_source_order_id = donor.id

    db.commit()
    return {"reallocated": moved, "target_order_id": target.id, "donor_order_id": donor.id}
