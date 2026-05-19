"""
returns.py — Returns & Repairs module router (Phase 1E).

All endpoints require authentication.
Prefix: /api/returns
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from state_activity_map import get_activity_description
from models import (
    Location,
    OrderNumbering,
    RepairOrder,
    RepairOrderSerial,
    ReturnOrder,
    ReturnOrderSerial,
    SerialNumber,
    StateHistory,
    TerminalState,
    User,
)
from schemas import (
    RepairOrderCreate,
    RepairOrderUpdate,
    ReturnOrderCreate,
    ReturnOrderUpdate,
)

router = APIRouter(prefix="/api/returns", tags=["returns"])


# ---------------------------------------------------------------------------
# Helpers: order number generation
# ---------------------------------------------------------------------------

def generate_return_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "ReturnOrder").first()
    if not row:
        return "RE000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


def generate_repair_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "RepairOrder").first()
    if not row:
        return "RR000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


# ---------------------------------------------------------------------------
# Helpers: state lookup
# ---------------------------------------------------------------------------

def get_state(db: Session, code: str) -> Optional[TerminalState]:
    return db.query(TerminalState).filter(TerminalState.code == code).first()


def transition_serial(
    db: Session,
    serial: SerialNumber,
    state: TerminalState,
    actor_user_id: int,
    notes: str,
    order_reference: str = None,
) -> None:
    serial.current_state_id = state.id
    history = StateHistory(
        serial_number_id=serial.id,
        state_id=state.id,
        location_id=serial.current_location_id,
        timezone="UTC",
        actor_type="user",
        actor_user_id=actor_user_id,
        activity_description=get_activity_description(state.code),
        order_reference=order_reference,
        notes=notes,
    )
    db.add(history)


# ---------------------------------------------------------------------------
# Helpers: ORM → dict serialisers
# ---------------------------------------------------------------------------

def _serial_summary(serial: SerialNumber) -> dict:
    return {
        "id": serial.id,
        "serial_number": serial.serial_number,
        "product_code": serial.product.code if serial.product else None,
        "current_state_code": serial.current_state.code if serial.current_state else None,
    }


def return_to_out(ro: ReturnOrder) -> dict:
    return {
        "id": ro.id,
        "order_number": ro.order_number,
        "original_order_id": ro.original_order_id,
        "original_order_number": ro.original_order.order_number if ro.original_order else None,
        "customer_id": ro.customer_id,
        "customer_name": ro.customer.name if ro.customer else None,
        "reason": ro.reason,
        "status": ro.status,
        "inspection_outcome": ro.inspection_outcome,
        "linked_replacement_order_id": ro.linked_replacement_order_id,
        "created_at": str(ro.created_at) if ro.created_at else None,
        "serials": [
            _serial_summary(ros.serial)
            for ros in ro.serials
            if ros.serial is not None
        ],
    }


def repair_to_out(ro: RepairOrder) -> dict:
    return {
        "id": ro.id,
        "order_number": ro.order_number,
        "return_order_id": ro.return_order_id,
        "repair_centre_location_id": ro.repair_centre_location_id,
        "repair_centre_name": ro.repair_centre.name if ro.repair_centre else None,
        "dispatch_date": ro.dispatch_date,
        "estimated_return_date": ro.estimated_return_date,
        "actual_return_date": ro.actual_return_date,
        "return_location_id": ro.return_location_id,
        "return_location_name": ro.return_location.name if ro.return_location else None,
        "status": ro.status,
        "outcome": ro.outcome,
        "actual_cost": ro.actual_cost,
        "actual_cost_currency": ro.actual_cost_currency,
        "repair_notes": ro.repair_notes,
        "created_at": str(ro.created_at) if ro.created_at else None,
        "serials": [
            _serial_summary(rrs.serial)
            for rrs in ro.serials
            if rrs.serial is not None
        ],
    }


# ===========================================================================
# Return Order endpoints
# ===========================================================================

# ---------------------------------------------------------------------------
# GET /api/returns/return-orders
# ---------------------------------------------------------------------------

@router.get("/return-orders")
def list_return_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all return orders. All authenticated users can view."""
    q = db.query(ReturnOrder)
    if status_filter:
        q = q.filter(ReturnOrder.status == status_filter)
    if customer_id:
        q = q.filter(ReturnOrder.customer_id == customer_id)
    orders = q.order_by(ReturnOrder.id.desc()).all()
    return [return_to_out(o) for o in orders]


# ---------------------------------------------------------------------------
# POST /api/returns/return-orders
# ---------------------------------------------------------------------------

@router.post("/return-orders", status_code=status.HTTP_201_CREATED)
def create_return_order(
    payload: ReturnOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new return order (supply_planner, warehouse_user, admin)."""
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Resolve serial IDs — accept serial_numbers (strings) or serial_ids (ints)
    resolved_ids: list = []
    if payload.serial_numbers:
        for sn in payload.serial_numbers:
            serial = db.query(SerialNumber).filter(
                SerialNumber.serial_number == sn.strip(),
                SerialNumber.active == 1
            ).first()
            if not serial:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Serial number '{sn}' not found or inactive",
                )
            resolved_ids.append(serial.id)
    elif payload.serial_ids:
        resolved_ids = payload.serial_ids
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one serial number is required",
        )

    order_number = generate_return_number(db)

    ro = ReturnOrder(
        order_number=order_number,
        original_order_id=payload.original_order_id,
        customer_id=payload.customer_id,
        reason=payload.reason,
        status="Initiated",
        created_by_user_id=current_user.id,
    )
    db.add(ro)
    db.flush()  # get ro.id

    defect_state = get_state(db, "DEFECT")

    for sid in resolved_ids:
        serial = db.query(SerialNumber).filter(SerialNumber.id == sid, SerialNumber.active == 1).first()
        if not serial:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial ID {sid} not found or inactive",
            )
        ros = ReturnOrderSerial(return_order_id=ro.id, serial_id=sid)
        db.add(ros)

        if defect_state:
            transition_serial(
                db, serial, defect_state, current_user.id,
                f"Return initiated via Return Order {order_number}",
                order_reference=order_number,
            )

    db.commit()
    db.refresh(ro)
    return return_to_out(ro)


# ---------------------------------------------------------------------------
# GET /api/returns/return-orders/by-number/{order_number}
# ---------------------------------------------------------------------------

@router.get("/return-orders/by-number/{order_number}")
def get_return_order_by_number(
    order_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ro = db.query(ReturnOrder).filter(ReturnOrder.order_number == order_number).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    return {"id": ro.id}


# ---------------------------------------------------------------------------
# GET /api/returns/return-orders/{id}
# ---------------------------------------------------------------------------

@router.get("/return-orders/{order_id}")
def get_return_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single return order with serials."""
    ro = db.query(ReturnOrder).filter(ReturnOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    return return_to_out(ro)


# ---------------------------------------------------------------------------
# PUT /api/returns/return-orders/{id}
# ---------------------------------------------------------------------------

@router.put("/return-orders/{order_id}")
def update_return_order(
    order_id: int,
    payload: ReturnOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update status / inspection_outcome (supply_planner, warehouse_user, admin)."""
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = db.query(ReturnOrder).filter(ReturnOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")

    if payload.status is not None:
        ro.status = payload.status

    if payload.inspection_outcome is not None:
        ro.inspection_outcome = payload.inspection_outcome
        ro.status = "Inspected"

        if payload.inspection_outcome == "Scrap":
            scrap_state = get_state(db, "SCRAP")
            if scrap_state:
                for ros in ro.serials:
                    if ros.serial:
                        ros.serial.active = 0
                        transition_serial(
                            db, ros.serial, scrap_state, current_user.id,
                            f"Scrapped via Return Order {ro.order_number}",
                            order_reference=ro.order_number,
                        )
        elif payload.inspection_outcome == "Defective":
            defect_state = get_state(db, "DEFECT")
            if defect_state:
                for ros in ro.serials:
                    if ros.serial and (
                        ros.serial.current_state is None
                        or ros.serial.current_state.code != "DEFECT"
                    ):
                        transition_serial(
                            db, ros.serial, defect_state, current_user.id,
                            f"Inspection outcome: Defective — Return Order {ro.order_number}",
                            order_reference=ro.order_number,
                        )

    db.commit()
    db.refresh(ro)
    return return_to_out(ro)


# ---------------------------------------------------------------------------
# POST /api/returns/return-orders/{id}/receive
# ---------------------------------------------------------------------------

@router.post("/return-orders/{order_id}/receive")
def receive_return_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark return order as received (warehouse_user, admin)."""
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = db.query(ReturnOrder).filter(ReturnOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")

    if ro.status not in ("Initiated", "In Transit"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot receive order in status '{ro.status}'",
        )

    investigation_state = get_state(db, "UNDER_INVESTIGATION")

    for ros in ro.serials:
        if ros.serial and investigation_state:
            # Update location to receiving warehouse — use original order's fulfilling location
            recv_loc = (
                ro.original_order.fulfilling_location_id
                if ro.original_order and ro.original_order.fulfilling_location_id
                else None
            )
            if recv_loc:
                ros.serial.current_location_id = recv_loc
            transition_serial(
                db, ros.serial, investigation_state, current_user.id,
                f"Return received — Return Order {ro.order_number}",
                order_reference=ro.order_number,
            )

    ro.status = "Received"
    db.commit()
    db.refresh(ro)
    return return_to_out(ro)


# ===========================================================================
# Repair Order endpoints
# ===========================================================================

# ---------------------------------------------------------------------------
# GET /api/returns/repair-orders
# ---------------------------------------------------------------------------

@router.get("/repair-orders")
def list_repair_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all repair orders."""
    allowed_roles = ("admin", "supply_planner", "warehouse_user", "repair_centre")
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q = db.query(RepairOrder)
    if status_filter:
        q = q.filter(RepairOrder.status == status_filter)
    orders = q.order_by(RepairOrder.id.desc()).all()
    return [repair_to_out(o) for o in orders]


# ---------------------------------------------------------------------------
# POST /api/returns/repair-orders
# ---------------------------------------------------------------------------

@router.post("/repair-orders", status_code=status.HTTP_201_CREATED)
def create_repair_order(
    payload: RepairOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new repair order (supply_planner, admin)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    if not payload.serial_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one serial ID is required",
        )

    # Validate repair centre location
    repair_centre = db.query(Location).filter(
        Location.id == payload.repair_centre_location_id
    ).first()
    if not repair_centre:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Location ID {payload.repair_centre_location_id} not found",
        )

    order_number = generate_repair_number(db)

    ro = RepairOrder(
        order_number=order_number,
        return_order_id=payload.return_order_id,
        repair_centre_location_id=payload.repair_centre_location_id,
        dispatch_date=payload.dispatch_date,
        estimated_return_date=payload.estimated_return_date,
        return_location_id=payload.return_location_id,
        status="Dispatched",
        created_by_user_id=current_user.id,
    )
    db.add(ro)
    db.flush()

    transit_repair_state = get_state(db, "TRANSIT_TO_REPAIR")

    for sid in payload.serial_ids:
        serial = db.query(SerialNumber).filter(SerialNumber.id == sid, SerialNumber.active == 1).first()
        if not serial:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial ID {sid} not found or inactive",
            )
        rrs = RepairOrderSerial(repair_order_id=ro.id, serial_id=sid)
        db.add(rrs)

        if transit_repair_state:
            transition_serial(
                db, serial, transit_repair_state, current_user.id,
                f"Dispatched to repair via Repair Order {order_number}",
                order_reference=order_number,
            )

    db.commit()
    db.refresh(ro)
    return repair_to_out(ro)


# ---------------------------------------------------------------------------
# GET /api/returns/repair-orders/by-number/{order_number}
# ---------------------------------------------------------------------------

@router.get("/repair-orders/by-number/{order_number}")
def get_repair_order_by_number(
    order_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ro = db.query(RepairOrder).filter(RepairOrder.order_number == order_number).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair order not found")
    return {"id": ro.id}


# ---------------------------------------------------------------------------
# GET /api/returns/repair-orders/{id}
# ---------------------------------------------------------------------------

@router.get("/repair-orders/{order_id}")
def get_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single repair order with serials."""
    ro = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair order not found")
    return repair_to_out(ro)


# ---------------------------------------------------------------------------
# PUT /api/returns/repair-orders/{id}
# ---------------------------------------------------------------------------

@router.put("/repair-orders/{order_id}")
def update_repair_order(
    order_id: int,
    payload: RepairOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update repair order (repair_centre, supply_planner, admin)."""
    if current_user.role not in ("admin", "supply_planner", "repair_centre"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair order not found")

    # Apply status transition first so we can act on the new status
    if payload.status is not None and payload.status != ro.status:
        new_status = payload.status

        if new_status == "Received at Repair Centre":
            in_repair_transit = get_state(db, "IN_REPAIR")
            if in_repair_transit:
                for rrs in ro.serials:
                    if rrs.serial:
                        # Update location to repair centre before recording history
                        if ro.repair_centre_location_id:
                            rrs.serial.current_location_id = ro.repair_centre_location_id
                        transition_serial(
                            db, rrs.serial, in_repair_transit, current_user.id,
                            f"Received at repair centre — Repair Order {ro.order_number}",
                            order_reference=ro.order_number,
                        )

        elif new_status == "Completed":
            quarantine_state = get_state(db, "QUARANTINE_REFURBISHED")
            if quarantine_state:
                for rrs in ro.serials:
                    if rrs.serial:
                        transition_serial(
                            db, rrs.serial, quarantine_state, current_user.id,
                            f"Repair completed — Repair Order {ro.order_number}",
                            order_reference=ro.order_number,
                        )

        elif new_status == "Returned":
            available_refurb = get_state(db, "AVAILABLE_REFURBISHED")
            if available_refurb:
                for rrs in ro.serials:
                    if rrs.serial:
                        # Update location to return_location if set
                        if ro.return_location_id:
                            rrs.serial.current_location_id = ro.return_location_id
                        transition_serial(
                            db, rrs.serial, available_refurb, current_user.id,
                            f"Returned from repair — Repair Order {ro.order_number}",
                            order_reference=ro.order_number,
                        )

        ro.status = new_status

    # Apply other field updates
    if payload.outcome is not None:
        ro.outcome = payload.outcome
    if payload.actual_cost is not None:
        ro.actual_cost = payload.actual_cost
    if payload.actual_cost_currency is not None:
        ro.actual_cost_currency = payload.actual_cost_currency
    if payload.repair_notes is not None:
        ro.repair_notes = payload.repair_notes
    if payload.estimated_return_date is not None:
        ro.estimated_return_date = payload.estimated_return_date
    if payload.actual_return_date is not None:
        ro.actual_return_date = payload.actual_return_date

    db.commit()
    db.refresh(ro)
    return repair_to_out(ro)
