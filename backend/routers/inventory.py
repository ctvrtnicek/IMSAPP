"""
inventory.py — Inventory module router (Phase 1B #2).

All endpoints require authentication.
Prefix: /api/inventory
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    Location,
    LocationType,
    NonSerialisedInventory,
    OutboundOrder,
    Product,
    PurchaseOrder,
    Firmware,
    SerialNumber,
    StateHistory,
    Supplier,
    TerminalState,
    User,
)
from schemas import (
    NonSerialisedCreate,
    NonSerialisedOut,
    NonSerialisedUpdate,
    SerialNumberOut,
    StateHistoryOut,
    TerminalStateOut,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ---------------------------------------------------------------------------
# Helper: build SerialNumberOut dict from ORM object
# ---------------------------------------------------------------------------

def serial_to_out(s: SerialNumber, latest_history: StateHistory = None) -> dict:
    # latest_history can be passed in to avoid N+1 queries
    lh = latest_history
    return {
        "id": s.id,
        "serial_number": s.serial_number,
        "supplier_id": s.supplier_id,
        "supplier_name": s.supplier.name if s.supplier else None,
        "product_id": s.product_id,
        "product_code": s.product.code if s.product else None,
        "product_name": s.product.name if s.product else None,
        "current_state_id": s.current_state_id,
        "current_state_code": s.current_state.code if s.current_state else None,
        "current_state_name": s.current_state.display_name if s.current_state else None,
        "current_location_id": s.current_location_id,
        "current_location_code": s.current_location.code if s.current_location else None,
        "current_location_name": s.current_location.name if s.current_location else None,
        "stock_type": s.stock_type,
        "security_seal": s.security_seal,
        "key_loaded": s.key_loaded,
        "active": s.active,
        "accumulated_cost": s.accumulated_cost or 0,
        "firmware_id": s.firmware_id,
        "firmware_name": s.firmware.firmware_name if s.firmware_id and s.firmware else None,
        "firmware_version": s.firmware.version if s.firmware_id and s.firmware else None,
        "firmware_applied_at": str(s.firmware_applied_at) if s.firmware_applied_at else None,
        "pegged_to_order_id": s.pegged_to_order_id,
        "pegged_to_order_number": None,
        "created_at": str(s.created_at) if s.created_at else None,
        # Latest state transition date + location (for All Terminals view)
        "latest_date": str(lh.datetime_utc) if lh and lh.datetime_utc else None,
        "latest_location_code": lh.location.code if lh and lh.location else (s.current_location.code if s.current_location else None),
        "latest_location_name": lh.location.name if lh and lh.location else (s.current_location.name if s.current_location else None),
    }


def history_to_out(h: StateHistory) -> dict:
    return {
        "id": h.id,
        "state_code": h.state.code if h.state else None,
        "state_name": h.state.display_name if h.state else None,
        "location_code": h.location.code if h.location else None,
        "location_name": h.location.name if h.location else None,
        "datetime_utc": str(h.datetime_utc) if h.datetime_utc else None,
        "timezone": h.timezone,
        "actor_type": h.actor_type,
        "actor_username": h.actor_user.username if h.actor_user else None,
        "notes": h.notes,
        "activity_description": getattr(h, "activity_description", None),
        "order_reference": getattr(h, "order_reference", None),
        "activity_cost": getattr(h, "activity_cost", None),
        "activity_cost_currency": getattr(h, "activity_cost_currency", None),
        "reporting_currency_equiv": getattr(h, "reporting_currency_equiv", None),
    }


def non_serialised_to_out(row: NonSerialisedInventory) -> dict:
    return {
        "id": row.id,
        "product_id": row.product_id,
        "product_code": row.product.code if row.product else None,
        "product_name": row.product.name if row.product else None,
        "location_id": row.location_id,
        "location_code": row.location.code if row.location else None,
        "location_name": row.location.name if row.location else None,
        "state": row.state,
        "quantity": row.quantity,
    }


# ---------------------------------------------------------------------------
# GET /api/inventory/states
# ---------------------------------------------------------------------------

@router.get("/states", response_model=List[TerminalStateOut])
def list_states(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List terminal states. Active only by default."""
    q = db.query(TerminalState)
    if not include_inactive:
        q = q.filter(TerminalState.active == 1)
    return q.order_by(TerminalState.id).all()


# ---------------------------------------------------------------------------
# GET /api/inventory/serials
# ---------------------------------------------------------------------------

@router.get("/serials")
def list_serials(
    state_code: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    stock_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List serial numbers with optional filters."""
    q = db.query(SerialNumber).filter(SerialNumber.active == 1)

    if state_code == "_PEGGED":
        q = q.filter(SerialNumber.pegged_to_order_id.isnot(None))
    elif state_code:
        q = q.join(TerminalState, SerialNumber.current_state_id == TerminalState.id).filter(
            TerminalState.code == state_code
        )
    if location_id is not None:
        q = q.filter(SerialNumber.current_location_id == location_id)
    if product_id is not None:
        q = q.filter(SerialNumber.product_id == product_id)
    if stock_type:
        q = q.filter(SerialNumber.stock_type == stock_type)
    if search:
        q = q.filter(SerialNumber.serial_number.ilike(f"%{search}%"))

    rows = q.limit(limit).all()

    # Fetch latest history entry per serial in one query
    serial_ids = [s.id for s in rows]
    latest_map = {}
    if serial_ids:
        # Subquery: max datetime_utc per serial
        from sqlalchemy import func as sqlfunc
        sub = (
            db.query(
                StateHistory.serial_number_id,
                sqlfunc.max(StateHistory.datetime_utc).label("max_dt"),
            )
            .filter(StateHistory.serial_number_id.in_(serial_ids))
            .group_by(StateHistory.serial_number_id)
            .subquery()
        )
        latest_rows = (
            db.query(StateHistory)
            .join(sub, (StateHistory.serial_number_id == sub.c.serial_number_id) &
                       (StateHistory.datetime_utc == sub.c.max_dt))
            .all()
        )
        for lh in latest_rows:
            latest_map[lh.serial_number_id] = lh

    results = [serial_to_out(s, latest_map.get(s.id)) for s in rows]

    pegged_ids = [r["pegged_to_order_id"] for r in results if r.get("pegged_to_order_id")]
    if pegged_ids:
        from models import OutboundOrder
        orders = db.query(OutboundOrder.id, OutboundOrder.order_number).filter(OutboundOrder.id.in_(set(pegged_ids))).all()
        order_map = {o.id: o.order_number for o in orders}
        for r in results:
            if r.get("pegged_to_order_id"):
                r["pegged_to_order_number"] = order_map.get(r["pegged_to_order_id"])

    return results


# ---------------------------------------------------------------------------
# GET /api/inventory/serials/{id}
# ---------------------------------------------------------------------------

@router.get("/serials/{serial_id}")
def get_serial_detail(
    serial_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single terminal's details plus state history."""
    s = db.query(SerialNumber).filter(SerialNumber.id == serial_id).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Serial number not found")

    history = (
        db.query(StateHistory)
        .filter(StateHistory.serial_number_id == serial_id)
        .order_by(StateHistory.datetime_utc.desc())
        .all()
    )

    return {
        "serial": serial_to_out(s),
        "history": [history_to_out(h) for h in history],
    }


# ---------------------------------------------------------------------------
# GET /api/inventory/by-state
# ---------------------------------------------------------------------------

@router.get("/by-state")
def by_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of active serial numbers grouped by state, ordered by count desc."""
    rows = (
        db.query(
            TerminalState.code.label("state_code"),
            TerminalState.display_name.label("state_name"),
            TerminalState.warehouse_type.label("warehouse_type"),
            func.count(SerialNumber.id).label("count"),
        )
        .join(SerialNumber, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1)
        .group_by(TerminalState.id, TerminalState.code, TerminalState.display_name, TerminalState.warehouse_type)
        .order_by(func.count(SerialNumber.id).desc())
        .all()
    )
    result = [
        {"state_code": r.state_code, "state_name": r.state_name, "warehouse_type": r.warehouse_type, "count": r.count}
        for r in rows
    ]

    pegged_count = db.query(func.count(SerialNumber.id)).filter(
        SerialNumber.active == 1, SerialNumber.pegged_to_order_id.isnot(None)
    ).scalar() or 0
    if pegged_count > 0:
        result.append({"state_code": "_PEGGED", "state_name": "Pegged", "warehouse_type": "Pegged", "count": pegged_count})

    return result


# ---------------------------------------------------------------------------
# GET /api/inventory/by-location
# ---------------------------------------------------------------------------

@router.get("/by-location")
def by_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of active serial numbers grouped by location."""
    # Serialised counts
    serialised_rows = (
        db.query(
            Location.id.label("location_id"),
            Location.code.label("location_code"),
            Location.name.label("location_name"),
            func.count(SerialNumber.id).label("serialised_count"),
        )
        .join(SerialNumber, SerialNumber.current_location_id == Location.id)
        .filter(SerialNumber.active == 1)
        .group_by(Location.id, Location.code, Location.name)
        .all()
    )

    # Non-serialised counts (sum of quantities)
    ns_rows = (
        db.query(
            NonSerialisedInventory.location_id,
            func.sum(NonSerialisedInventory.quantity).label("ns_count"),
        )
        .group_by(NonSerialisedInventory.location_id)
        .all()
    )
    ns_map = {r.location_id: (r.ns_count or 0) for r in ns_rows}

    # Accumulated cost per location
    cost_rows = (
        db.query(
            SerialNumber.current_location_id,
            func.sum(SerialNumber.accumulated_cost).label("total_cost"),
        )
        .filter(SerialNumber.active == 1, SerialNumber.accumulated_cost.isnot(None))
        .group_by(SerialNumber.current_location_id)
        .all()
    )
    cost_map = {r.current_location_id: float(r.total_cost or 0) for r in cost_rows}

    results = []
    for r in serialised_rows:
        results.append({
            "location_id": r.location_id,
            "location_code": r.location_code,
            "location_name": r.location_name,
            "serialised_count": r.serialised_count,
            "non_serialised_count": ns_map.get(r.location_id, 0),
            "total_cost": cost_map.get(r.location_id, 0),
        })

    # Also include locations with only non-serialised stock
    serialised_loc_ids = {r.location_id for r in serialised_rows}
    for loc_id, ns_count in ns_map.items():
        if loc_id not in serialised_loc_ids:
            loc = db.query(Location).filter(Location.id == loc_id).first()
            if loc:
                results.append({
                    "location_id": loc.id,
                    "location_code": loc.code,
                    "location_name": loc.name,
                    "serialised_count": 0,
                    "non_serialised_count": ns_count,
                    "total_cost": cost_map.get(loc_id, 0),
                })

    # Enrich with accruals data
    from datetime import date, timedelta
    today = date.today()
    first_of_month = today.replace(day=1).isoformat()

    # Pre-fetch location types and reporting currencies for all locations in results
    loc_ids = [r["location_id"] for r in results]
    loc_objs = {loc.id: loc for loc in db.query(Location).filter(Location.id.in_(loc_ids)).all()} if loc_ids else {}

    # Sum reporting_currency_equiv from StateHistory this month per location
    accruals_rows = (
        db.query(
            StateHistory.location_id,
            func.sum(StateHistory.reporting_currency_equiv).label("total_equiv"),
        )
        .filter(
            StateHistory.location_id.in_(loc_ids),
            StateHistory.datetime_utc >= first_of_month,
            StateHistory.reporting_currency_equiv.isnot(None),
        )
        .group_by(StateHistory.location_id)
        .all()
    ) if loc_ids else []
    accruals_map = {r.location_id: float(r.total_equiv or 0) for r in accruals_rows}

    for r in results:
        loc = loc_objs.get(r["location_id"])
        lt = loc.location_type if loc else None
        accruals_applicable = lt.accruals_applicable if lt else "NA"
        r["accruals_applicable"] = accruals_applicable
        r["reporting_currency"] = loc.reporting_currency if loc else "EUR"
        r["expected_accruals"] = accruals_map.get(r["location_id"], 0)

        # Compute next_accruals_date
        if accruals_applicable == "WEEKLY":
            days_ahead = 7 - today.weekday()  # Monday = 0
            r["next_accruals_date"] = (today + timedelta(days=days_ahead)).isoformat()
        elif accruals_applicable == "MONTHLY":
            if today.month == 12:
                r["next_accruals_date"] = date(today.year + 1, 1, 1).isoformat()
            else:
                r["next_accruals_date"] = date(today.year, today.month + 1, 1).isoformat()
        elif accruals_applicable == "QUARTERLY":
            quarter_start_month = ((today.month - 1) // 3 + 1) * 3 + 1
            if quarter_start_month > 12:
                r["next_accruals_date"] = date(today.year + 1, quarter_start_month - 12, 1).isoformat()
            else:
                r["next_accruals_date"] = date(today.year, quarter_start_month, 1).isoformat()
        else:
            r["next_accruals_date"] = None

    results.sort(key=lambda x: x["serialised_count"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# GET /api/inventory/by-product
# ---------------------------------------------------------------------------

TRANSIT_CODES = ("TRANSIT_TO_COMPANY", "TRANSIT_TO_REPAIR", "TRANSIT_TO_WAREHOUSE")
AVAILABLE_CODES = ("AVAILABLE", "AVAILABLE_REFURBISHED")
REPAIR_CODES = ("IN_REPAIR",)


@router.get("/by-product")
def by_product(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of active serial numbers grouped by product."""
    # Total per product
    total_rows = (
        db.query(
            Product.id.label("product_id"),
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            func.count(SerialNumber.id).label("total"),
        )
        .join(SerialNumber, SerialNumber.product_id == Product.id)
        .filter(SerialNumber.active == 1)
        .group_by(Product.id, Product.code, Product.name)
        .all()
    )

    # Available counts
    avail_rows = (
        db.query(
            SerialNumber.product_id,
            func.count(SerialNumber.id).label("cnt"),
        )
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1, TerminalState.code.in_(AVAILABLE_CODES))
        .group_by(SerialNumber.product_id)
        .all()
    )
    avail_map = {r.product_id: r.cnt for r in avail_rows}

    # In-transit counts
    transit_rows = (
        db.query(
            SerialNumber.product_id,
            func.count(SerialNumber.id).label("cnt"),
        )
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1, TerminalState.code.in_(TRANSIT_CODES))
        .group_by(SerialNumber.product_id)
        .all()
    )
    transit_map = {r.product_id: r.cnt for r in transit_rows}

    # In-repair counts
    repair_rows = (
        db.query(
            SerialNumber.product_id,
            func.count(SerialNumber.id).label("cnt"),
        )
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1, TerminalState.code.in_(REPAIR_CODES))
        .group_by(SerialNumber.product_id)
        .all()
    )
    repair_map = {r.product_id: r.cnt for r in repair_rows}

    # Total accumulated cost per product
    cost_rows = (
        db.query(
            SerialNumber.product_id,
            func.sum(SerialNumber.accumulated_cost).label("total_cost"),
        )
        .filter(SerialNumber.active == 1, SerialNumber.accumulated_cost.isnot(None))
        .group_by(SerialNumber.product_id)
        .all()
    )
    cost_map_prod = {r.product_id: float(r.total_cost or 0) for r in cost_rows}

    return [
        {
            "product_id": r.product_id,
            "product_code": r.product_code,
            "product_name": r.product_name,
            "total": r.total,
            "available": avail_map.get(r.product_id, 0),
            "in_transit": transit_map.get(r.product_id, 0),
            "in_repair": repair_map.get(r.product_id, 0),
            "total_cost": cost_map_prod.get(r.product_id, 0),
        }
        for r in total_rows
    ]


# ---------------------------------------------------------------------------
# GET /api/inventory/expecting  (kept for backwards compatibility)
# ---------------------------------------------------------------------------

@router.get("/expecting")
def list_expecting(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All terminals currently in EXPECTING state."""
    rows = (
        db.query(SerialNumber)
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1, TerminalState.code == "EXPECTING")
        .all()
    )
    return [serial_to_out(s) for s in rows]


# ---------------------------------------------------------------------------
# GET /api/inventory/in-transit
# ---------------------------------------------------------------------------

IN_TRANSIT_CODES = ("EXPECTING", "TRANSIT_TO_COMPANY", "TRANSIT_TO_WAREHOUSE", "TRANSIT_TO_REPAIR")

@router.get("/in-transit")
def list_in_transit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All terminals in any in-transit state."""
    from sqlalchemy import func as sqlfunc
    rows = (
        db.query(SerialNumber)
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1, TerminalState.code.in_(IN_TRANSIT_CODES))
        .all()
    )

    # Fetch latest history per serial to get latest_date and order_reference
    serial_ids = [s.id for s in rows]
    latest_map = {}
    if serial_ids:
        sub = (
            db.query(
                StateHistory.serial_number_id,
                sqlfunc.max(StateHistory.datetime_utc).label("max_dt"),
            )
            .filter(StateHistory.serial_number_id.in_(serial_ids))
            .group_by(StateHistory.serial_number_id)
            .subquery()
        )
        latest_rows = (
            db.query(StateHistory)
            .join(sub, (StateHistory.serial_number_id == sub.c.serial_number_id) &
                       (StateHistory.datetime_utc == sub.c.max_dt))
            .all()
        )
        for lh in latest_rows:
            latest_map[lh.serial_number_id] = lh

    # Build a map of order_reference → destination label
    # Collect all unique order refs that appear in the history
    order_refs = set()
    for lh in latest_map.values():
        ref = getattr(lh, "order_reference", None)
        if ref:
            order_refs.add(ref)

    dest_map = {}  # order_ref → destination string
    for ref in order_refs:
        if not ref:
            continue
        prefix = ref[:2].upper() if len(ref) >= 2 else ""
        if prefix == "PO":
            # PO: destination is the PO's destination_location
            po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == ref).first()
            if po and po.destination_location:
                dest_map[ref] = po.destination_location.name or po.destination_location.code
        elif prefix in ("SO", "RN", "RP"):
            # Outbound to customer: show customer name + country
            order = db.query(OutboundOrder).filter(OutboundOrder.order_number == ref).first()
            if order:
                if order.customer:
                    parts = [order.customer.name]
                    if order.customer.state_region:
                        parts.append(order.customer.state_region)
                    parts.append(order.customer.country)
                    dest_map[ref] = ", ".join(p for p in parts if p)
                elif order.destination_location:
                    dest_map[ref] = order.destination_location.name or order.destination_location.code
        elif prefix == "DS":
            # Distribution: destination warehouse
            order = db.query(OutboundOrder).filter(OutboundOrder.order_number == ref).first()
            if order and order.destination_location:
                dest_map[ref] = order.destination_location.name or order.destination_location.code
        elif prefix in ("RE", "RR"):
            # Return/Repair: origin location is the "to" location for context
            pass

    result = []
    for s in rows:
        lh = latest_map.get(s.id)
        out = serial_to_out(s, lh)
        ref = lh.order_reference if lh and hasattr(lh, "order_reference") else None
        out["order_reference"] = ref
        out["to_location_label"] = dest_map.get(ref) if ref else None
        result.append(out)
    return result


# ---------------------------------------------------------------------------
# GET /api/inventory/non-serialised
# ---------------------------------------------------------------------------

@router.get("/non-serialised")
def list_non_serialised(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all non-serialised inventory rows."""
    rows = db.query(NonSerialisedInventory).all()
    return [non_serialised_to_out(r) for r in rows]


# ---------------------------------------------------------------------------
# POST /api/inventory/non-serialised
# ---------------------------------------------------------------------------

@router.post("/non-serialised", status_code=status.HTTP_201_CREATED)
def create_non_serialised(
    payload: NonSerialisedCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new non-serialised inventory entry (admin / warehouse_user only)."""
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or warehouse_user only")

    row = NonSerialisedInventory(
        product_id=payload.product_id,
        location_id=payload.location_id,
        state=payload.state,
        quantity=payload.quantity,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return non_serialised_to_out(row)


# ---------------------------------------------------------------------------
# PUT /api/inventory/non-serialised/{id}
# ---------------------------------------------------------------------------

@router.put("/non-serialised/{ns_id}")
def update_non_serialised(
    ns_id: int,
    payload: NonSerialisedUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update quantity/state of a non-serialised inventory row (admin / warehouse_user only)."""
    if current_user.role not in ("admin", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or warehouse_user only")

    row = db.query(NonSerialisedInventory).filter(NonSerialisedInventory.id == ns_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Non-serialised inventory row not found")

    row.quantity = payload.quantity
    if payload.state is not None:
        row.state = payload.state

    db.commit()
    db.refresh(row)
    return non_serialised_to_out(row)
