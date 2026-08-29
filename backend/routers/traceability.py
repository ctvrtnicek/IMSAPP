"""Phase 3E — Traceability & RMA"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    SerialNumber, StateHistory, TerminalState, Location, User,
    PurchaseOrder, OutboundOrder, DistributionOrder, ReturnOrder,
    RepairReworkOrder, RepairOrder, OrderNumbering, ReturnOrderSerial,
    RepairOrderSerial,
)

router = APIRouter(prefix="/api/traceability", tags=["traceability"])


@router.get("/serial/{serial_number}")
def get_traceability(
    serial_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full traceability view for a serial number."""
    s = db.query(SerialNumber).filter(SerialNumber.serial_number == serial_number, SerialNumber.active == 1).first()
    if not s:
        raise HTTPException(404, "Serial number not found")

    # State history
    history = (
        db.query(StateHistory)
        .filter(StateHistory.serial_number_id == s.id)
        .order_by(StateHistory.datetime_utc.asc())
        .all()
    )

    history_out = []
    for h in history:
        history_out.append({
            "id": h.id,
            "state_code": h.state.code if h.state else None,
            "state_name": h.state.display_name if h.state else None,
            "location_code": h.location.code if h.location else None,
            "location_name": h.location.name if h.location else None,
            "datetime_utc": str(h.datetime_utc) if h.datetime_utc else None,
            "actor_type": h.actor_type,
            "actor_user": h.actor_user.username if h.actor_user else None,
            "activity_description": h.activity_description,
            "order_reference": h.order_reference,
            "notes": h.notes,
        })

    # Collect all order references
    order_refs = set()
    for h in history:
        if h.order_reference:
            order_refs.add(h.order_reference)

    orders = []
    for ref in sorted(order_refs):
        prefix = ref[:2].upper()
        order_type = {"PO": "Purchase Order", "SO": "Sales Order", "RN": "Rental", "RP": "Replacement",
                      "DS": "Distribution", "RE": "Return", "RR": "Repair"}.get(prefix, "Order")
        orders.append({"reference": ref, "type": order_type})

    # Original PO
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == s.po_id).first() if s.po_id else None

    # RMA references from return orders
    rma_refs = []
    ret_serials = db.query(ReturnOrderSerial).filter(ReturnOrderSerial.serial_id == s.id).all()
    for rs in ret_serials:
        ret = db.query(ReturnOrder).filter(ReturnOrder.id == rs.return_order_id).first()
        if ret and ret.rma_reference:
            rma_refs.append({"rma_reference": ret.rma_reference, "return_order": ret.order_number})

    return {
        "serial": {
            "id": s.id,
            "serial_number": s.serial_number,
            "product_code": s.product.code if s.product else None,
            "product_name": s.product.name if s.product else None,
            "supplier_name": s.supplier.name if s.supplier else None,
            "current_state": s.current_state.display_name if s.current_state else None,
            "current_state_code": s.current_state.code if s.current_state else None,
            "current_location_code": s.current_location.code if s.current_location else None,
            "current_location_name": s.current_location.name if s.current_location else None,
            "stock_type": s.stock_type,
            "firmware_name": s.firmware.firmware_name if s.firmware else None,
            "firmware_version": s.firmware.version if s.firmware else None,
            "accumulated_cost": s.accumulated_cost or 0,
            "pegged_to_order_id": s.pegged_to_order_id,
        },
        "original_po": {
            "po_number": po.po_number,
            "order_date": po.order_date,
            "received_date": po.received_date,
            "supplier_name": po.supplier.name if po.supplier else None,
        } if po else None,
        "history": history_out,
        "order_references": orders,
        "rma_references": rma_refs,
    }


class RMAInitiateRequest(BaseModel):
    serial_id: int
    reason: str = "RMA initiated from traceability"


@router.post("/initiate-rma")
def initiate_rma(
    payload: RMAInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate RMA: creates Return Order (Open) + paired Repair & Rework Order (Draft) with shared RMA reference."""
    roles = getattr(current_user, "roles_list", [current_user.role])
    if not any(r in ("admin", "supply_planner", "rma_manager") for r in roles):
        raise HTTPException(403, "RMA Manager, Supply Planner, or Admin only")

    serial = db.query(SerialNumber).filter(SerialNumber.id == payload.serial_id, SerialNumber.active == 1).first()
    if not serial:
        raise HTTPException(404, "Serial not found")

    # Generate RMA reference — auto-seed row if missing
    rma_row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "RMA").with_for_update().first()
    if not rma_row:
        # Also check legacy 'RMAOrder' key from older migrations
        rma_row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "RMAOrder").with_for_update().first()
        if rma_row:
            rma_row.order_type = "RMA"
        else:
            rma_row = OrderNumbering(order_type="RMA", prefix="RMA", padding_length=6, current_sequence=0)
            db.add(rma_row)
            db.flush()
    rma_row.current_sequence += 1
    rma_ref = f"{rma_row.prefix}{str(rma_row.current_sequence).zfill(rma_row.padding_length)}"

    # Generate Return Order number — auto-seed if missing
    re_row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "ReturnOrder").with_for_update().first()
    if not re_row:
        re_row = OrderNumbering(order_type="ReturnOrder", prefix="RE", padding_length=6, current_sequence=0)
        db.add(re_row)
        db.flush()
    re_row.current_sequence += 1
    re_number = f"{re_row.prefix}{str(re_row.current_sequence).zfill(re_row.padding_length)}"

    # Generate RR Order number — auto-seed if missing
    rr_row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "RepairReworkOrder").with_for_update().first()
    if not rr_row:
        rr_row = OrderNumbering(order_type="RepairReworkOrder", prefix="RR", padding_length=6, current_sequence=0)
        db.add(rr_row)
        db.flush()
    rr_row.current_sequence += 1
    rr_number = f"{rr_row.prefix}{str(rr_row.current_sequence).zfill(rr_row.padding_length)}"

    # Create Return Order (Open)
    ret = ReturnOrder(
        order_number=re_number,
        reason=payload.reason,
        status="Open",
        rma_reference=rma_ref,
        created_by_user_id=current_user.id,
    )
    db.add(ret)
    db.flush()

    # Link serial to return order
    db.add(ReturnOrderSerial(return_order_id=ret.id, serial_id=serial.id))

    # Create paired Repair & Rework Order (Draft)
    rr = RepairReworkOrder(
        order_number=rr_number,
        dispatch_type="Repair",
        reason=payload.reason,
        status="Draft",
        rma_reference=rma_ref,
        location_id=serial.current_location_id,
        created_by_user_id=current_user.id,
    )
    db.add(rr)
    db.flush()

    # Link return to RR
    ret.linked_rr_order_id = rr.id

    db.commit()

    return {
        "rma_reference": rma_ref,
        "return_order_number": re_number,
        "repair_order_number": rr_number,
    }
