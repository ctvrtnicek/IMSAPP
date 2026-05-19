"""
terminal_states.py — CRUD router for TerminalState master data.

Prefix: /api/terminal-states
Write endpoints (POST, PUT) are admin-only.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import LocationType, StateValidLocationType, TerminalState, User
from schemas import TerminalStateCreate, TerminalStateOut
from state_activity_map import get_activity_description

router = APIRouter(prefix="/api/terminal-states", tags=["terminal-states"])


def _state_to_out(ts: TerminalState, db: Session) -> dict:
    rows = db.query(StateValidLocationType).filter(
        StateValidLocationType.state_id == ts.id
    ).all()
    return {
        "id": ts.id,
        "code": ts.code,
        "display_name": ts.display_name,
        "warehouse_type": ts.warehouse_type,
        "description": ts.description,
        "activity_description": get_activity_description(ts.code),
        "active": ts.active,
        "sequence_number": ts.sequence_number,
        "expected_duration_value": ts.expected_duration_value,
        "expected_duration_unit": ts.expected_duration_unit,
        "valid_location_type_ids": [r.location_type_id for r in rows],
    }


def _set_valid_location_types(state_id: int, type_ids: List[int], db: Session):
    db.query(StateValidLocationType).filter(
        StateValidLocationType.state_id == state_id
    ).delete()
    for tid in (type_ids or []):
        db.add(StateValidLocationType(state_id=state_id, location_type_id=tid))


@router.get("")
def list_terminal_states(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all terminal states."""
    q = db.query(TerminalState)
    if not include_inactive:
        q = q.filter(TerminalState.active == 1)
    states = q.order_by(TerminalState.sequence_number.nullsfirst(), TerminalState.id).all()
    return [_state_to_out(ts, db) for ts in states]


@router.get("/location-types")
def list_location_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all location types (for multi-select in state config)."""
    rows = db.query(LocationType).filter(LocationType.active == 1).order_by(LocationType.id).all()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_terminal_state(
    payload: TerminalStateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new terminal state (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    existing = db.query(TerminalState).filter(TerminalState.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Terminal state code already exists")

    ts = TerminalState(
        code=payload.code,
        display_name=payload.display_name,
        warehouse_type=payload.warehouse_type,
        description=payload.description,
        sequence_number=payload.sequence_number,
        expected_duration_value=payload.expected_duration_value,
        expected_duration_unit=payload.expected_duration_unit,
        active=1,
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    if payload.valid_location_type_ids:
        _set_valid_location_types(ts.id, payload.valid_location_type_ids, db)
        db.commit()
    return _state_to_out(ts, db)


@router.put("/{state_id}")
def update_terminal_state(
    state_id: int,
    payload: TerminalStateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a terminal state (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    ts = db.query(TerminalState).filter(TerminalState.id == state_id).first()
    if not ts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Terminal state not found")

    ts.code = payload.code
    ts.display_name = payload.display_name
    ts.warehouse_type = payload.warehouse_type
    ts.description = payload.description
    ts.sequence_number = payload.sequence_number
    ts.expected_duration_value = payload.expected_duration_value
    ts.expected_duration_unit = payload.expected_duration_unit

    if payload.valid_location_type_ids is not None:
        _set_valid_location_types(ts.id, payload.valid_location_type_ids, db)

    db.commit()
    db.refresh(ts)
    return _state_to_out(ts, db)
