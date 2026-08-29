"""
warehouse.py — Warehouse / State-Update router.

All endpoints require authentication.
Prefix: /api/warehouse
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Location, Product, SerialNumber, StateHistory, TerminalState, User
from routers.cost_engine import apply_cost
from state_activity_map import get_activity_description

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class StateUpdatePayload(BaseModel):
    serial_ids: List[int]
    to_state_code: str
    location_id: Optional[int] = None
    notes: Optional[str] = None
    firmware_id: Optional[int] = None


class SingleStateUpdatePayload(BaseModel):
    serial_id: int
    to_state_code: str
    location_id: Optional[int] = None
    firmware_id: Optional[int] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: lightweight serial dict for warehouse views
# ---------------------------------------------------------------------------

def serial_to_out(s: SerialNumber) -> dict:
    return {
        "id": s.id,
        "serial_number": s.serial_number,
        "product_code": s.product.code if s.product else None,
        "product_name": s.product.name if s.product else None,
        "current_state_code": s.current_state.code if s.current_state else None,
        "current_state_name": s.current_state.display_name if s.current_state else None,
        "current_location_code": s.current_location.code if s.current_location else None,
        "current_location_name": s.current_location.name if s.current_location else None,
        "stock_type": s.stock_type,
        "accumulated_cost": s.accumulated_cost or 0,
    }


# ---------------------------------------------------------------------------
# Internal helper: move one serial to a new state
# ---------------------------------------------------------------------------

def _apply_state_change(
    serial: SerialNumber,
    target_state: TerminalState,
    location_id: Optional[int],
    notes: Optional[str],
    current_user: User,
    db: Session,
    order_reference: Optional[str] = None,
    firmware_id: Optional[int] = None,
) -> None:
    effective_location_id = location_id if location_id is not None else serial.current_location_id
    serial.current_state_id = target_state.id
    if location_id is not None:
        serial.current_location_id = location_id
    if firmware_id and target_state.code == "ENCRYPTION_KEY_LOADED":
        from datetime import datetime
        serial.firmware_id = firmware_id
        serial.firmware_applied_at = datetime.utcnow()

    history = StateHistory(
        serial_number_id=serial.id,
        state_id=target_state.id,
        location_id=effective_location_id,
        actor_type="user",
        actor_user_id=current_user.id,
        activity_description=get_activity_description(target_state.code),
        order_reference=order_reference,
        notes=notes,
    )
    db.add(history)

    if effective_location_id:
        apply_cost(db, serial, history, target_state.code, effective_location_id)


# ---------------------------------------------------------------------------
# GET /api/warehouse/serials-by-state
# ---------------------------------------------------------------------------

@router.get("/serials-by-state")
def get_serials_by_state(
    state_code: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return active serial numbers filtered by state code and/or location."""
    q = db.query(SerialNumber).filter(SerialNumber.active == 1)

    if state_code:
        q = q.join(
            TerminalState, SerialNumber.current_state_id == TerminalState.id
        ).filter(TerminalState.code == state_code)

    if location_id is not None:
        q = q.filter(SerialNumber.current_location_id == location_id)

    rows = q.order_by(SerialNumber.serial_number).all()
    return [serial_to_out(s) for s in rows]


# ---------------------------------------------------------------------------
# POST /api/warehouse/state-update  (bulk)
# ---------------------------------------------------------------------------

@router.post("/state-update")
def bulk_state_update(
    payload: StateUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a list of serial numbers to a new state. warehouse_user or admin only."""
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or warehouse_user only",
        )

    target_state = (
        db.query(TerminalState)
        .filter(TerminalState.code == payload.to_state_code)
        .first()
    )
    if not target_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"State '{payload.to_state_code}' not found",
        )

    updated = 0
    errors: List[str] = []

    for serial_id in payload.serial_ids:
        serial = db.query(SerialNumber).filter(SerialNumber.id == serial_id).first()
        if not serial:
            errors.append(f"Serial ID {serial_id} not found")
            continue

        try:
            _apply_state_change(
                serial=serial,
                target_state=target_state,
                location_id=payload.location_id,
                notes=payload.notes,
                current_user=current_user,
                db=db,
                firmware_id=payload.firmware_id,
            )
            updated += 1
        except Exception as exc:
            errors.append(f"Serial ID {serial_id}: {exc}")

    db.commit()
    return {"updated": updated, "errors": errors}


# ---------------------------------------------------------------------------
# POST /api/warehouse/state-update-single
# ---------------------------------------------------------------------------

@router.post("/state-update-single")
def single_state_update(
    payload: SingleStateUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a single serial number to a new state. warehouse_user or admin only."""
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or warehouse_user only",
        )

    serial = db.query(SerialNumber).filter(SerialNumber.id == payload.serial_id).first()
    if not serial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Serial ID {payload.serial_id} not found",
        )

    target_state = (
        db.query(TerminalState)
        .filter(TerminalState.code == payload.to_state_code)
        .first()
    )
    if not target_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"State '{payload.to_state_code}' not found",
        )

    _apply_state_change(
        serial=serial,
        target_state=target_state,
        location_id=payload.location_id,
        notes=payload.notes,
        current_user=current_user,
        db=db,
        firmware_id=payload.firmware_id,
    )
    db.commit()
    db.refresh(serial)

    return {"updated": 1, "serial": serial_to_out(serial)}
