"""
Repair & Rework Orders router (v1.3) — uses repair_rework_orders table.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from database import get_db
from models import RepairReworkOrder, RepairReworkSerial, SerialNumber, Location, User, OrderNumbering
from routers.auth import get_current_user

router = APIRouter(prefix="/api/repair-rework", tags=["Repair & Rework"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RRCreate(BaseModel):
    dispatch_type: str = "Repair"  # Repair | Rework
    reason: Optional[str] = None
    location_id: Optional[int] = None
    environment: str = "Live"
    serial_ids: list[int] = []


class RRUpdate(BaseModel):
    status: Optional[str] = None
    dispatch_type: Optional[str] = None
    reason: Optional[str] = None
    outcome: Optional[str] = None
    actual_cost: Optional[float] = None
    actual_cost_currency: Optional[str] = None
    repair_notes: Optional[str] = None
    estimated_return_date: Optional[str] = None
    actual_return_date: Optional[str] = None
    return_location_id: Optional[int] = None
    # Outbound shipping
    ship_to_company: Optional[str] = None
    ship_to_addr_line1: Optional[str] = None
    ship_to_addr_city: Optional[str] = None
    ship_to_addr_country: Optional[str] = None
    tracking_carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    outbound_shipped_at: Optional[str] = None
    # Inbound return
    inbounded_at: Optional[str] = None
    inbound_key: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _next_rr_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter_by(order_type="RepairReworkOrder").with_for_update().first()
    if not row:
        row = OrderNumbering(order_type="RepairReworkOrder", prefix="RR", padding_length=6, current_sequence=0)
        db.add(row)
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


def _rr_to_out(o: RepairReworkOrder, db: Session) -> dict:
    serials = []
    for s in o.serials:
        sn = s.serial if s.serial else None
        serials.append({
            "id": s.id,
            "serial_id": s.serial_id,
            "serial_number": sn.serial_number if sn else None,
            "product_code": (sn.product.code if sn and sn.product else s.product_code),
        })

    loc_name = None
    if o.location_id:
        loc = db.query(Location).get(o.location_id)
        loc_name = f"{loc.code} — {loc.name}" if loc else None

    return {
        "id": o.id,
        "order_number": o.order_number,
        "dispatch_type": o.dispatch_type,
        "reason": o.reason,
        "status": o.status,
        "environment": o.environment,
        "location_id": o.location_id,
        "location_name": loc_name,
        "external_reference": o.external_reference,
        "ship_to_company": o.ship_to_company,
        "ship_to_addr_line1": o.ship_to_addr_line1,
        "ship_to_addr_city": o.ship_to_addr_city,
        "ship_to_addr_country": o.ship_to_addr_country,
        "tracking_carrier": o.tracking_carrier,
        "tracking_number": o.tracking_number,
        "outbound_shipped_at": o.outbound_shipped_at.isoformat() if o.outbound_shipped_at else None,
        "estimated_return_date": o.estimated_return_date,
        "actual_return_date": o.actual_return_date,
        "inbounded_at": o.inbounded_at.isoformat() if o.inbounded_at else None,
        "inbound_key": o.inbound_key,
        "outcome": o.outcome,
        "actual_cost": o.actual_cost,
        "actual_cost_currency": o.actual_cost_currency,
        "repair_notes": o.repair_notes,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "serials": serials,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
def list_rr_orders(
    dispatch_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(RepairReworkOrder)
    if dispatch_type:
        q = q.filter(RepairReworkOrder.dispatch_type == dispatch_type)
    if status:
        q = q.filter(RepairReworkOrder.status == status)
    orders = q.order_by(RepairReworkOrder.created_at.desc()).all()
    return [_rr_to_out(o, db) for o in orders]


@router.get("/{order_id}")
def get_rr_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = db.query(RepairReworkOrder).get(order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Repair/Rework order not found")
    return _rr_to_out(o, db)


@router.post("", status_code=201)
def create_rr_order(
    payload: RRCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    order_number = _next_rr_number(db)
    o = RepairReworkOrder(
        order_number=order_number,
        dispatch_type=payload.dispatch_type,
        reason=payload.reason,
        location_id=payload.location_id,
        environment=payload.environment,
        status="Draft",
        created_by_user_id=current_user.id,
    )
    db.add(o)
    db.flush()

    for sid in payload.serial_ids:
        sn = db.query(SerialNumber).get(sid)
        if sn:
            db.add(RepairReworkSerial(rr_order_id=o.id, serial_id=sid))

    db.commit()
    db.refresh(o)
    return _rr_to_out(o, db)


@router.put("/{order_id}")
def update_rr_order(
    order_id: int,
    payload: RRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = db.query(RepairReworkOrder).get(order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(o, field, value)

    db.commit()
    db.refresh(o)
    return _rr_to_out(o, db)


@router.post("/{order_id}/dispatch")
def dispatch_rr_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark as Dispatched (outbound shipped)."""
    o = db.query(RepairReworkOrder).get(order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Not found")
    o.status = "Dispatched"
    o.outbound_shipped_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return _rr_to_out(o, db)


@router.post("/{order_id}/receive-back")
def receive_back_rr_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark as Returned (inbound received back)."""
    o = db.query(RepairReworkOrder).get(order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Not found")
    o.status = "Returned"
    o.inbounded_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return _rr_to_out(o, db)
