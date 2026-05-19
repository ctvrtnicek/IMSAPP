"""
work_orders.py — Work Orders router (Phase 2F).

Endpoints:
  GET    /api/work-orders                  list
  GET    /api/work-orders/{id}             detail
  POST   /api/work-orders/{id}/acknowledge Open → Acknowledged
  POST   /api/work-orders/{id}/start       Acknowledged → In Progress
  POST   /api/work-orders/{id}/complete    complete with confirmed serials
  POST   /api/work-orders/{id}/cancel      cancel
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    Location,
    OutboundOrder,
    OutboundOrderLine,
    OutboundOrderSerial,
    SerialNumber,
    User,
    WorkOrder,
    WorkOrderLine,
)

router = APIRouter(prefix="/api/work-orders", tags=["work-orders"])


# ---------------------------------------------------------------------------
# Pydantic payloads
# ---------------------------------------------------------------------------

class CompleteLineItem(BaseModel):
    work_order_line_id: int
    confirmed_serial_id: Optional[int] = None   # None = short pick


class OverPickItem(BaseModel):
    outbound_order_line_id: int
    serial_id: int


class CompletePayload(BaseModel):
    lines: List[CompleteLineItem] = []
    over_picks: List[OverPickItem] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serial_brief(sn):
    if not sn:
        return None
    return {
        "id": sn.id,
        "serial_number": sn.serial_number,
        "current_state_id": sn.current_state_id,
        "current_location_id": sn.current_location_id,
    }


def _line_to_out(wol: WorkOrderLine):
    return {
        "id": wol.id,
        "work_order_id": wol.work_order_id,
        "outbound_order_line_id": wol.outbound_order_line_id,
        "allocated_serial": _serial_brief(wol.allocated_serial),
        "confirmed_serial": _serial_brief(wol.confirmed_serial),
        "is_short_pick": bool(wol.is_short_pick),
        "is_over_pick": bool(wol.is_over_pick),
        # product info from the OOL
        "product_code": wol.outbound_order_line.product.code if wol.outbound_order_line and wol.outbound_order_line.product else None,
        "product_name": wol.outbound_order_line.product.name if wol.outbound_order_line and wol.outbound_order_line.product else None,
        "line_number": wol.outbound_order_line.line_number if wol.outbound_order_line else None,
    }


def _wo_to_out(wo: WorkOrder, include_lines=False):
    out = {
        "id": wo.id,
        "order_number": wo.order_number,
        "outbound_order_id": wo.outbound_order_id,
        "outbound_order_number": wo.outbound_order.order_number if wo.outbound_order else None,
        "outbound_order_type": wo.outbound_order.order_type if wo.outbound_order else None,
        "wo_type": wo.wo_type,
        "status": wo.status,
        "location_id": wo.location_id,
        "location_code": wo.location.code if wo.location else None,
        "location_name": wo.location.name if wo.location else None,
        "notes": wo.notes,
        "created_at": wo.created_at.isoformat() if wo.created_at else None,
        "created_by": wo.created_by.username if wo.created_by else None,
    }
    if include_lines:
        out["lines"] = [_line_to_out(l) for l in wo.lines]
    return out


# ---------------------------------------------------------------------------
# GET /api/work-orders
# ---------------------------------------------------------------------------

@router.get("")
def list_work_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    location_id: Optional[int] = Query(None),
    outbound_order_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(WorkOrder)
    if status_filter:
        q = q.filter(WorkOrder.status == status_filter)
    if location_id:
        q = q.filter(WorkOrder.location_id == location_id)
    if outbound_order_id:
        q = q.filter(WorkOrder.outbound_order_id == outbound_order_id)
    wos = q.order_by(WorkOrder.created_at.desc()).all()
    return [_wo_to_out(wo) for wo in wos]


# ---------------------------------------------------------------------------
# GET /api/work-orders/{id}
# ---------------------------------------------------------------------------

@router.get("/{wo_id}")
def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# GET /api/work-orders/by-number/{order_number}
# ---------------------------------------------------------------------------

@router.get("/by-number/{order_number}")
def get_work_order_by_number(
    order_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wo = db.query(WorkOrder).filter(WorkOrder.order_number == order_number).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return {"id": wo.id}


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/acknowledge
# ---------------------------------------------------------------------------

@router.post("/{wo_id}/acknowledge")
def acknowledge_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status != "Open":
        raise HTTPException(status_code=400, detail=f"Cannot acknowledge WO in status '{wo.status}'")
    wo.status = "Acknowledged"
    db.commit()
    db.refresh(wo)
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/start
# ---------------------------------------------------------------------------

@router.post("/{wo_id}/start")
def start_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status != "Acknowledged":
        raise HTTPException(status_code=400, detail=f"Cannot start WO in status '{wo.status}'")
    wo.status = "In Progress"
    db.commit()
    db.refresh(wo)
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/complete
# ---------------------------------------------------------------------------

@router.post("/{wo_id}/complete")
def complete_work_order(
    wo_id: int,
    payload: CompletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm picks and close the work order.

    - For each line in payload.lines: set confirmed_serial_id (or mark short-pick if null).
    - For each over_pick: create a new WO line and new OutboundOrderSerial.
    - Update OutboundOrderSerial records to swap allocated → confirmed where they differ.
    - Remove OutboundOrderSerial records for short-picked lines.
    - Mark WO Complete.
    """
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")

    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status not in ("Open", "Acknowledged", "In Progress"):
        raise HTTPException(status_code=400, detail=f"Cannot complete WO in status '{wo.status}'")

    # Build line lookup
    line_map = {wol.id: wol for wol in wo.lines}

    # Process confirmations
    for item in payload.lines:
        wol = line_map.get(item.work_order_line_id)
        if not wol:
            raise HTTPException(status_code=400, detail=f"WO line {item.work_order_line_id} not found")

        if item.confirmed_serial_id is None:
            # Short pick
            wol.is_short_pick = 1
            wol.confirmed_serial_id = None
            # Remove the OutboundOrderSerial record for this line
            if wol.allocated_serial_id:
                oos = (
                    db.query(OutboundOrderSerial)
                    .filter(
                        OutboundOrderSerial.order_id == wo.outbound_order_id,
                        OutboundOrderSerial.serial_id == wol.allocated_serial_id,
                    )
                    .first()
                )
                if oos:
                    db.delete(oos)
        else:
            # Verify the confirmed serial exists and is at this location
            confirmed_sn = db.query(SerialNumber).filter(
                SerialNumber.id == item.confirmed_serial_id,
                SerialNumber.active == 1,
            ).first()
            if not confirmed_sn:
                raise HTTPException(status_code=400, detail=f"Serial ID {item.confirmed_serial_id} not found")
            if wo.location_id and confirmed_sn.current_location_id != wo.location_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Serial {confirmed_sn.serial_number} is not at the work order location",
                )

            wol.confirmed_serial_id = item.confirmed_serial_id

            # If serial was swapped, update OutboundOrderSerial
            if wol.allocated_serial_id and item.confirmed_serial_id != wol.allocated_serial_id:
                oos = (
                    db.query(OutboundOrderSerial)
                    .filter(
                        OutboundOrderSerial.order_id == wo.outbound_order_id,
                        OutboundOrderSerial.serial_id == wol.allocated_serial_id,
                    )
                    .first()
                )
                if oos:
                    oos.serial_id = item.confirmed_serial_id

    # Process over-picks
    for op in payload.over_picks:
        # Validate serial
        sn = db.query(SerialNumber).filter(
            SerialNumber.id == op.serial_id,
            SerialNumber.active == 1,
        ).first()
        if not sn:
            raise HTTPException(status_code=400, detail=f"Serial ID {op.serial_id} not found")
        if wo.location_id and sn.current_location_id != wo.location_id:
            raise HTTPException(
                status_code=400,
                detail=f"Serial {sn.serial_number} is not at the work order location",
            )

        # Add new WO line
        new_wol = WorkOrderLine(
            work_order_id=wo_id,
            outbound_order_line_id=op.outbound_order_line_id,
            allocated_serial_id=None,
            confirmed_serial_id=op.serial_id,
            is_over_pick=1,
        )
        db.add(new_wol)

        # Add new OutboundOrderSerial
        new_oos = OutboundOrderSerial(
            order_id=wo.outbound_order_id,
            order_line_id=op.outbound_order_line_id,
            serial_id=op.serial_id,
        )
        db.add(new_oos)

    wo.status = "Complete"
    db.commit()
    db.refresh(wo)
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/cancel
# ---------------------------------------------------------------------------

@router.post("/{wo_id}/cancel")
def cancel_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=403, detail="supply_planner or admin only")
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status in ("Complete", "Cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel WO in status '{wo.status}'")
    wo.status = "Cancelled"
    db.commit()
    db.refresh(wo)
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/reverse
# ---------------------------------------------------------------------------

@router.post("/{wo_id}/reverse")
def reverse_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reverse a Completed WO back to In Progress.
    - Restores OutboundOrderSerial records for short-picked lines
    - Reverts swapped serials back to allocated serial on OutboundOrderSerial
    - Removes over-pick WO lines and their OutboundOrderSerial records
    - Clears confirmed_serial_id and is_short_pick on all remaining lines
    """
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.status != "Complete":
        raise HTTPException(status_code=400, detail=f"Only Complete WOs can be reversed (current: '{wo.status}')")

    for wol in list(wo.lines):
        if wol.is_over_pick:
            # Remove the over-pick OutboundOrderSerial
            if wol.confirmed_serial_id:
                oos = (
                    db.query(OutboundOrderSerial)
                    .filter(
                        OutboundOrderSerial.order_id == wo.outbound_order_id,
                        OutboundOrderSerial.serial_id == wol.confirmed_serial_id,
                    )
                    .first()
                )
                if oos:
                    db.delete(oos)
            db.delete(wol)
        elif wol.is_short_pick:
            # Re-create OutboundOrderSerial for the originally allocated serial
            if wol.allocated_serial_id and wol.outbound_order_line_id:
                existing = (
                    db.query(OutboundOrderSerial)
                    .filter(
                        OutboundOrderSerial.order_id == wo.outbound_order_id,
                        OutboundOrderSerial.serial_id == wol.allocated_serial_id,
                    )
                    .first()
                )
                if not existing:
                    db.add(OutboundOrderSerial(
                        order_id=wo.outbound_order_id,
                        order_line_id=wol.outbound_order_line_id,
                        serial_id=wol.allocated_serial_id,
                    ))
            wol.is_short_pick = 0
            wol.confirmed_serial_id = None
        else:
            # Possibly swapped — restore OOS to allocated serial
            if wol.confirmed_serial_id and wol.allocated_serial_id and wol.confirmed_serial_id != wol.allocated_serial_id:
                oos = (
                    db.query(OutboundOrderSerial)
                    .filter(
                        OutboundOrderSerial.order_id == wo.outbound_order_id,
                        OutboundOrderSerial.serial_id == wol.confirmed_serial_id,
                    )
                    .first()
                )
                if oos:
                    oos.serial_id = wol.allocated_serial_id
            wol.confirmed_serial_id = None

    wo.status = "In Progress"
    db.commit()
    db.refresh(wo)
    return _wo_to_out(wo, include_lines=True)


# ---------------------------------------------------------------------------
# GET /api/work-orders/serials-at-location/{location_id}
# ---------------------------------------------------------------------------

@router.get("/serials-at-location/{location_id}")
def serials_at_location(
    location_id: int,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return active serials at a given location for WO serial picker."""
    q = db.query(SerialNumber).filter(
        SerialNumber.current_location_id == location_id,
        SerialNumber.active == 1,
    )
    if search:
        q = q.filter(SerialNumber.serial_number.ilike(f"%{search}%"))
    serials = q.limit(100).all()
    return [
        {
            "id": sn.id,
            "serial_number": sn.serial_number,
            "current_state_id": sn.current_state_id,
            "current_location_id": sn.current_location_id,
        }
        for sn in serials
    ]


# ---------------------------------------------------------------------------
# POST /api/work-orders/recharge  — create a Recharge Work Order
# ---------------------------------------------------------------------------

class RechargeWOCreate(BaseModel):
    location_id: int
    product_id: Optional[int] = None    # if None, includes all products at location
    notes: Optional[str] = None


@router.post("/recharge", status_code=201)
def create_recharge_work_order(
    payload: RechargeWOCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a Recharge Work Order for all terminals at a location needing recharge.
    Terminals are identified as those with battery_life_days set on their product
    and whose last RECHARGED/QUARANTINE event is overdue.
    """
    from models import TerminalState, StateHistory, Product
    from datetime import datetime, timezone

    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")

    recharged_state = db.query(TerminalState).filter(TerminalState.code == "RECHARGED").first()
    quarantine_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE").first()
    reset_ids = {s.id for s in [recharged_state, quarantine_state] if s}

    # Find serials at location that need recharge
    q = db.query(SerialNumber).filter(
        SerialNumber.current_location_id == payload.location_id,
        SerialNumber.active == 1,
    )
    if payload.product_id:
        q = q.filter(SerialNumber.product_id == payload.product_id)

    serials = q.all()
    serial_ids_to_charge = []

    for s in serials:
        product = db.query(Product).filter(Product.id == s.product_id).first()
        if not product or not product.battery_life_days:
            continue
        # Find most recent reset
        last_reset = (
            db.query(StateHistory)
            .filter(StateHistory.serial_number_id == s.id, StateHistory.state_id.in_(reset_ids))
            .order_by(StateHistory.datetime_utc.desc())
            .first()
        )
        if not last_reset:
            continue
        try:
            dt = datetime.fromisoformat(str(last_reset.datetime_utc).replace("Z", "+00:00")).replace(tzinfo=None)
            days_since = (datetime.utcnow() - dt).days
        except Exception:
            continue
        if days_since >= product.battery_life_days - 7:  # within 7 days of needing recharge
            serial_ids_to_charge.append(s.id)

    if not serial_ids_to_charge:
        raise HTTPException(status_code=400, detail="No terminals at this location require recharging.")

    # Generate WO number
    import random
    wo_num = f"RCH-{datetime.utcnow().strftime('%Y%m%d')}-{random.randint(100, 999)}"
    while db.query(WorkOrder).filter(WorkOrder.order_number == wo_num).first():
        wo_num = f"RCH-{datetime.utcnow().strftime('%Y%m%d')}-{random.randint(100, 999)}"

    wo = WorkOrder(
        order_number=wo_num,
        outbound_order_id=None,
        wo_type="Recharge",
        status="Open",
        location_id=payload.location_id,
        notes=payload.notes or f"Battery recharge for {len(serial_ids_to_charge)} terminals",
        created_by_user_id=current_user.id,
    )
    db.add(wo)
    db.flush()

    for sid in serial_ids_to_charge:
        line = WorkOrderLine(
            work_order_id=wo.id,
            outbound_order_line_id=None,
            allocated_serial_id=sid,
        )
        db.add(line)

    db.commit()
    db.refresh(wo)
    return {"id": wo.id, "order_number": wo.order_number, "terminal_count": len(serial_ids_to_charge)}


# ---------------------------------------------------------------------------
# POST /api/work-orders/{id}/complete-recharge
# ---------------------------------------------------------------------------

class RechargeCompletePayload(BaseModel):
    serial_ids: List[int]


@router.post("/{wo_id}/complete-recharge")
def complete_recharge_work_order(
    wo_id: int,
    payload: RechargeCompletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Complete a Recharge WO — transitions listed serials to RECHARGED state."""
    from models import TerminalState, StateHistory
    from datetime import datetime

    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=403, detail="warehouse_user or admin only")

    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.wo_type != "Recharge":
        raise HTTPException(status_code=400, detail="This endpoint is only for Recharge WOs")
    if wo.status not in ("Open", "In Progress"):
        raise HTTPException(status_code=400, detail=f"Cannot complete WO in status '{wo.status}'")

    recharged_state = db.query(TerminalState).filter(TerminalState.code == "RECHARGED").first()
    if not recharged_state:
        raise HTTPException(status_code=500, detail="RECHARGED state not found in database")

    for sid in payload.serial_ids:
        sn = db.query(SerialNumber).filter(SerialNumber.id == sid, SerialNumber.active == 1).first()
        if not sn:
            continue
        sn.current_state_id = recharged_state.id
        history = StateHistory(
            serial_number_id=sn.id,
            state_id=recharged_state.id,
            location_id=sn.current_location_id,
            notes=f"Recharged via WO {wo.order_number}",
            actor_type="user",
            actor_user_id=current_user.id,
        )
        db.add(history)

    wo.status = "Complete"
    db.commit()
    return {"ok": True, "serials_recharged": len(payload.serial_ids)}
