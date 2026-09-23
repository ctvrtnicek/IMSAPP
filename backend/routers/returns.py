"""
returns.py — Returns & Repairs module router (Phase 1E).

All endpoints require authentication.
Prefix: /api/returns
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session

from auth import get_current_user
from scoping import Scope, get_scope
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


def _roles(user: User) -> set:
    """All roles held by the user (user_roles), falling back to the legacy primary role."""
    return set(getattr(user, "roles_list", None) or [user.role])


# Appendix A: Returns is "No access" for Repair Center and Supplier users.
RETURNS_NO_ACCESS_ROLES = {"repair_centre", "supplier"}


def _require_returns_access(user: User):
    if _roles(user) <= RETURNS_NO_ACCESS_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to return orders")


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
    activity_cost: float = None,
    activity_cost_currency: str = None,
    reporting_currency_equiv: float = None,
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
        activity_cost=activity_cost,
        activity_cost_currency=activity_cost_currency,
        reporting_currency_equiv=reporting_currency_equiv,
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


def _receiving_location(ro: ReturnOrder):
    """Warehouse a return is received at. ASSUMPTION (see scoping.py): the warehouse that
    shipped the original order. None when the return has no original order."""
    return ro.original_order.fulfilling_location if ro.original_order else None


def return_to_out(ro: ReturnOrder) -> dict:
    recv = _receiving_location(ro)
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
        "receiving_location_id": recv.id if recv else None,
        "receiving_location_name": recv.name if recv else None,
        "repair_orders": [
            {"id": r.id, "order_number": r.order_number, "status": r.status}
            for r in sorted(ro.repair_orders, key=lambda r: r.id)
        ],
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
        "return_order_number": ro.return_order.order_number if ro.return_order else None,
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
        "created_by": ro.created_by.username if ro.created_by else None,
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
    scope: Scope = Depends(get_scope),
):
    """List return orders visible to the caller (see scoping.py)."""
    _require_returns_access(current_user)
    q = db.query(ReturnOrder)
    if status_filter:
        q = q.filter(ReturnOrder.status == status_filter)
    if customer_id:
        q = q.filter(ReturnOrder.customer_id == customer_id)
    q = scope.apply(q, scope.return_filter)
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
    scope: Scope = Depends(get_scope),
):
    """Create a new return order (supply_planner, warehouse_user, admin)."""
    if not _roles(current_user) & {"admin", "supply_planner", "warehouse_user"}:
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
    scope: Scope = Depends(get_scope),
):
    _require_returns_access(current_user)
    ro = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.order_number == order_number).first()
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
    scope: Scope = Depends(get_scope),
):
    """Get a single return order with serials."""
    _require_returns_access(current_user)
    ro = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.id == order_id).first()
    if not ro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
    out = return_to_out(ro)
    out["can_create_repair"] = _repair_blocker(ro, current_user, scope) is None
    return out


# ---------------------------------------------------------------------------
# PUT /api/returns/return-orders/{id}
# ---------------------------------------------------------------------------

@router.put("/return-orders/{order_id}")
def update_return_order(
    order_id: int,
    payload: ReturnOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    """Update status / inspection_outcome (supply_planner, warehouse_user, admin)."""
    if not _roles(current_user) & {"admin", "supply_planner", "warehouse_user"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.id == order_id).first()
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
    scope: Scope = Depends(get_scope),
):
    """Mark return order as received (warehouse_user, admin)."""
    if not _roles(current_user) & {"admin", "warehouse_user"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.id == order_id).first()
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

REPAIR_CREATE_ROLES = {"admin", "supply_planner", "warehouse_user"}


def _repair_blocker(ret: ReturnOrder, user: User, scope: Scope) -> Optional[str]:
    """Why the user can't create a repair order from this return right now, or None if they can."""
    roles = _roles(user)
    if not roles & REPAIR_CREATE_ROLES:
        return "Not authorised to create repair orders"
    if ret.status != "Inspected" or ret.inspection_outcome != "Defective":
        return "Repair orders can only be created for returns inspected as Defective"
    if not roles & {"admin", "supply_planner"}:
        # Warehouse user: only for returns received at one of their own warehouses
        recv = _receiving_location(ret)
        if not recv or recv.id not in scope.location_ids:
            return "This return was not received at your warehouse"
    if ret.repair_orders:
        # One repair order per return (RE000003's two repairs pre-date this rule)
        return f"Repair order {ret.repair_orders[0].order_number} already exists for this return"
    return None


# ---------------------------------------------------------------------------
# GET /api/returns/repair-orders
# ---------------------------------------------------------------------------

@router.get("/repair-orders")
def list_repair_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    """List all repair orders."""
    allowed_roles = ("admin", "supply_planner", "warehouse_user", "repair_centre")
    if not _roles(current_user) & set(allowed_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q = scope.apply(db.query(RepairOrder), scope.repair_order_filter)
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
    scope: Scope = Depends(get_scope),
):
    """Create a repair order from a Defective return (admin, supply_planner, or a warehouse
    user at the warehouse the return was received at)."""
    if not _roles(current_user) & REPAIR_CREATE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin, supply planner or warehouse user only")

    ret = None
    if payload.return_order_id is not None:
        ret = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.id == payload.return_order_id).first()
        if not ret:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Return order not found")
        blocker = _repair_blocker(ret, current_user, scope)
        if blocker:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=blocker)
        return_serial_ids = {s.serial_id for s in ret.serials}
        if not set(payload.serial_ids) <= return_serial_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Serials must belong to the return order")
    elif not _roles(current_user) & {"admin", "supply_planner"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse users create repair orders from a return order")

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
    if not repair_centre.location_type or repair_centre.location_type.name != "Repair Centre":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{repair_centre.code} is not a repair centre")

    # Default: repaired terminals go back to the warehouse that received the return
    return_location_id = payload.return_location_id
    if return_location_id is None and ret is not None:
        recv = _receiving_location(ret)
        return_location_id = recv.id if recv else None

    order_number = generate_repair_number(db)

    ro = RepairOrder(
        order_number=order_number,
        return_order_id=payload.return_order_id,
        repair_centre_location_id=payload.repair_centre_location_id,
        dispatch_date=payload.dispatch_date,
        estimated_return_date=payload.estimated_return_date,
        return_location_id=return_location_id,
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
    scope: Scope = Depends(get_scope),
):
    ro = scope.apply(db.query(RepairOrder), scope.repair_order_filter).filter(RepairOrder.order_number == order_number).first()
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
    scope: Scope = Depends(get_scope),
):
    """Get a single repair order with serials."""
    ro = scope.apply(db.query(RepairOrder), scope.repair_order_filter).filter(RepairOrder.id == order_id).first()
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
    scope: Scope = Depends(get_scope),
):
    """Update repair order (repair_centre, supply_planner, admin)."""
    if not _roles(current_user) & {"admin", "supply_planner", "repair_centre"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ro = scope.apply(db.query(RepairOrder), scope.repair_order_filter).filter(RepairOrder.id == order_id).first()
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
                # Resolve cost at transition time (payload may update it simultaneously)
                resolved_cost = payload.actual_cost if payload.actual_cost is not None else ro.actual_cost
                resolved_currency = payload.actual_cost_currency if payload.actual_cost_currency is not None else ro.actual_cost_currency
                num_serials = len([s for s in ro.serials if s.serial])
                cost_per_serial = (resolved_cost / num_serials) if (resolved_cost is not None and num_serials > 0) else None
                for rrs in ro.serials:
                    if rrs.serial:
                        # Update location to return_location if set
                        if ro.return_location_id:
                            rrs.serial.current_location_id = ro.return_location_id
                        transition_serial(
                            db, rrs.serial, available_refurb, current_user.id,
                            f"Returned from repair — Repair Order {ro.order_number}",
                            order_reference=ro.order_number,
                            activity_cost=cost_per_serial,
                            activity_cost_currency=resolved_currency,
                            reporting_currency_equiv=cost_per_serial,
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


# ---------------------------------------------------------------------------
# Phase 3E / R3 #16 — Repair order documents (upload / list / download)
# Stored in the DB, not on disk: Render's filesystem is wiped on every deploy.
# ---------------------------------------------------------------------------
import os

ALLOWED_DOC_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp'}
MAX_DOC_BYTES = 2 * 1024 * 1024
DOC_UPLOAD_ROLES = {"admin", "supply_planner", "warehouse_user", "repair_centre", "rma_manager"}


def _visible_repair_order(db: Session, scope: Scope, repair_order_id: int) -> RepairOrder:
    ro = scope.apply(db.query(RepairOrder), scope.repair_order_filter).filter(RepairOrder.id == repair_order_id).first()
    if not ro:
        raise HTTPException(404, "Repair order not found")
    return ro


def _doc_to_out(d) -> dict:
    return {
        "id": d.id,
        "file_name": d.file_name,
        "content_type": d.content_type,
        "file_size_bytes": d.file_size_bytes,
        "uploaded_at": str(d.uploaded_at) if d.uploaded_at else None,
        "uploaded_by": d.uploaded_by.username if d.uploaded_by else None,
    }


@router.post("/repair/{repair_order_id}/documents")
async def upload_repair_document(
    repair_order_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    """Upload a document (PDF / image) against a repair order. Stored for reference, no AI processing."""
    from models import RepairDocument
    if not _roles(current_user) & DOC_UPLOAD_ROLES:
        raise HTTPException(403, "Not authorized to upload repair documents")
    _visible_repair_order(db, scope, repair_order_id)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed. Accepted: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}")

    contents = await file.read()
    if len(contents) > MAX_DOC_BYTES:
        raise HTTPException(400, "File too large. Maximum 2MB.")

    doc = RepairDocument(
        repair_order_id=repair_order_id,
        file_name=os.path.basename(file.filename),
        content_type=file.content_type,
        data=contents,
        file_size_bytes=len(contents),
        uploaded_by_user_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_out(doc)


@router.get("/repair/{repair_order_id}/documents")
def list_repair_documents(
    repair_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    """List documents uploaded to a repair order (file name, upload date, uploader)."""
    from models import RepairDocument
    _visible_repair_order(db, scope, repair_order_id)
    docs = (
        db.query(RepairDocument)
        .filter(RepairDocument.repair_order_id == repair_order_id)
        .order_by(RepairDocument.uploaded_at.desc())
        .all()
    )
    return [_doc_to_out(d) for d in docs]


@router.get("/repair/{repair_order_id}/documents/{doc_id}")
def download_repair_document(
    repair_order_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scope: Scope = Depends(get_scope),
):
    from fastapi import Response
    from models import RepairDocument
    _visible_repair_order(db, scope, repair_order_id)
    d = db.query(RepairDocument).filter(
        RepairDocument.id == doc_id, RepairDocument.repair_order_id == repair_order_id
    ).first()
    if not d:
        raise HTTPException(404, "Document not found")
    return Response(
        content=d.data,
        media_type=d.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{d.file_name}"'},
    )
