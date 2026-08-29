"""
outbound_orders.py — Outbound Orders module router (Phase 1D).

All endpoints require authentication.
Prefix: /api/outbound-orders
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from state_activity_map import get_activity_description
from models import (
    Customer,
    Location,
    LocationType,
    OrderNumbering,
    OutboundOrder,
    OutboundOrderLine,
    OutboundOrderSerial,
    Product,
    SerialNumber,
    StateHistory,
    TerminalState,
    User,
    WorkOrder,
    WorkOrderLine,
)
from schemas import (
    OutboundOrderCreate,
    OutboundOrderOut,
    OutboundOrderUpdate,
)

router = APIRouter(prefix="/api/outbound-orders", tags=["outbound-orders"])


# ---------------------------------------------------------------------------
# Inline Pydantic models for action payloads
# ---------------------------------------------------------------------------

class AllocationItem(BaseModel):
    serial_id: int
    order_line_id: int


class AllocatePayload(BaseModel):
    allocations: List[AllocationItem]


class ShipPayload(BaseModel):
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    shipped_date: Optional[str] = None
    estimated_arrival_date: Optional[str] = None
    shipping_cost: Optional[float] = None
    shipping_cost_currency: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: generate order number
# ---------------------------------------------------------------------------

ORDER_TYPE_MAP = {
    "Sales": "SalesOrder",
    "Rental": "RentalOrder",
    "Replacement": "ReplacementOrder",
    "Distribution": "DistributionOrder",
}


def generate_order_number(db: Session, order_type: str) -> str:
    ot_key = ORDER_TYPE_MAP.get(order_type, "SalesOrder")
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == ot_key).first()
    if not row:
        prefix_map = {"Sales": "SO", "Rental": "RN", "Replacement": "RP", "Distribution": "DS"}
        return f"{prefix_map.get(order_type, 'SO')}000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


# ---------------------------------------------------------------------------
# Helper: build order dict from ORM object
# ---------------------------------------------------------------------------

def line_to_out(line: OutboundOrderLine) -> dict:
    return {
        "id": line.id,
        "line_number": line.line_number,
        "product_id": line.product_id,
        "product_code": line.product.code if line.product else None,
        "product_name": line.product.name if line.product else None,
        "quantity": line.quantity,
        "atp_status": line.atp_status,
        "edd": line.edd,
        "fulfilling_location_id": line.fulfilling_location_id,
        "fulfilling_location_code": line.fulfilling_location.code if line.fulfilling_location else None,
        "bom_assembly_status": line.bom_assembly_status,
        "atp_reasoning": line.atp_reasoning,
        "atp_split_details": __import__('json').loads(line.atp_split_details) if line.atp_split_details else None,
    }


def serial_to_out(oos: OutboundOrderSerial) -> dict:
    s = oos.serial
    return {
        "id": oos.id,
        "order_line_id": oos.order_line_id,
        "serial_id": oos.serial_id,
        "serial_number": s.serial_number if s else None,
        "product_code": s.product.code if s and s.product else None,
        "current_state_code": s.current_state.code if s and s.current_state else None,
        "current_location_code": s.current_location.code if s and s.current_location else None,
    }


def order_to_out(order: OutboundOrder, include_lines: bool = True) -> dict:
    result = {
        "id": order.id,
        "order_number": order.order_number,
        "order_type": order.order_type,
        "status": order.status,
        "customer_id": order.customer_id,
        "customer_name": order.customer.name if order.customer else None,
        "destination_location_id": order.destination_location_id,
        "destination_location_code": (
            order.destination_location.code if order.destination_location else None
        ),
        "fulfilling_location_id": order.fulfilling_location_id,
        "fulfilling_location_code": (
            order.fulfilling_location.code if order.fulfilling_location else None
        ),
        "atp_ship_date": order.atp_ship_date,
        "atp_delivery_date": order.atp_delivery_date,
        "atp_feasible": order.atp_feasible,
        "carrier": order.carrier,
        "tracking_number": order.tracking_number,
        "shipped_date": order.shipped_date,
        "estimated_arrival_date": order.estimated_arrival_date,
        "shipping_cost": order.shipping_cost,
        "shipping_cost_currency": order.shipping_cost_currency,
        "rental_period_months": order.rental_period_months,
        "rental_fee": order.rental_fee,
        "rental_fee_currency": order.rental_fee_currency,
        "rental_expected_return_date": order.rental_expected_return_date,
        "created_at": str(order.created_at) if order.created_at else None,
        "lines": [],
        "allocated_serials": [],
    }
    if include_lines:
        result["lines"] = [line_to_out(line) for line in order.lines]
        result["allocated_serials"] = [serial_to_out(oos) for oos in order.serials]
    return result


# ---------------------------------------------------------------------------
# GET /api/outbound-orders/available-serials
# NOTE: This MUST be defined before /{id} routes to avoid path conflicts.
# ---------------------------------------------------------------------------

@router.get("/available-serials")
def get_available_serials(
    product_id: int = Query(...),
    location_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return AVAILABLE serials for a given product at a given location."""
    available_states = (
        db.query(TerminalState)
        .filter(TerminalState.code.in_(["AVAILABLE", "AVAILABLE_REFURBISHED"]))
        .all()
    )
    available_state_ids = [s.id for s in available_states]

    serials = (
        db.query(SerialNumber)
        .filter(
            SerialNumber.product_id == product_id,
            SerialNumber.current_location_id == location_id,
            SerialNumber.current_state_id.in_(available_state_ids),
            SerialNumber.active == 1,
        )
        .all()
    )

    return [
        {
            "id": s.id,
            "serial_number": s.serial_number,
            "product_code": s.product.code if s.product else None,
            "current_state_code": s.current_state.code if s.current_state else None,
            "current_location_code": s.current_location.code if s.current_location else None,
        }
        for s in serials
    ]


# ---------------------------------------------------------------------------
# GET /api/outbound-orders
# ---------------------------------------------------------------------------

@router.get("")
def list_outbound_orders(
    order_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all outbound orders (header only, no lines)."""
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q = db.query(OutboundOrder)
    if order_type:
        q = q.filter(OutboundOrder.order_type == order_type)
    if status_filter:
        q = q.filter(OutboundOrder.status == status_filter)
    if customer_id:
        q = q.filter(OutboundOrder.customer_id == customer_id)

    orders = q.order_by(OutboundOrder.id.desc()).all()
    return [order_to_out(o, include_lines=False) for o in orders]


# ---------------------------------------------------------------------------
# POST /api/outbound-orders
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
def create_outbound_order(
    payload: OutboundOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new outbound order (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    if not payload.lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one line is required")

    valid_types = ("Sales", "Rental", "Replacement", "Distribution")
    if payload.order_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"order_type must be one of: {', '.join(valid_types)}",
        )

    order_number = generate_order_number(db, payload.order_type)

    # Calculate rental return date if applicable
    rental_expected_return_date = None
    if payload.order_type == "Rental" and payload.rental_period_months:
        today = date.today()
        delta_days = payload.rental_period_months * 30
        rental_expected_return_date = (today + timedelta(days=delta_days)).isoformat()

    order = OutboundOrder(
        order_number=order_number,
        order_type=payload.order_type,
        status="Draft",
        customer_id=payload.customer_id,
        destination_location_id=payload.destination_location_id,
        fulfilling_location_id=payload.fulfilling_location_id,
        rental_period_months=payload.rental_period_months if payload.order_type == "Rental" else None,
        rental_fee=payload.rental_fee if payload.order_type == "Rental" else None,
        rental_fee_currency=payload.rental_fee_currency if payload.order_type == "Rental" else None,
        rental_expected_return_date=rental_expected_return_date,
        created_by_user_id=current_user.id,
    )
    db.add(order)
    db.flush()  # get order.id

    for idx, line_payload in enumerate(payload.lines, start=1):
        line = OutboundOrderLine(
            order_id=order.id,
            line_number=idx,
            product_id=line_payload.product_id,
            quantity=line_payload.quantity,
        )
        db.add(line)

    db.commit()
    db.refresh(order)

    # Auto-run ATP if order has lines
    try:
        from atp_engine import run_atp_for_order
        run_atp_for_order(db, order.id)
    except Exception:
        pass  # ATP failure should not block order creation

    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# GET /api/outbound-orders/by-number/{order_number}
# ---------------------------------------------------------------------------

@router.get("/by-number/{order_number}")
def get_outbound_order_by_number(
    order_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single outbound order by order number."""
    order = db.query(OutboundOrder).filter(OutboundOrder.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# GET /api/outbound-orders/{id}
# ---------------------------------------------------------------------------

@router.get("/{order_id}")
def get_outbound_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single outbound order with full lines and allocated serials."""
    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# PUT /api/outbound-orders/{id}
# ---------------------------------------------------------------------------

@router.put("/{order_id}")
def update_outbound_order(
    order_id: int,
    payload: OutboundOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update outbound order fields (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if payload.status is not None:
        order.status = payload.status
    if payload.fulfilling_location_id is not None:
        order.fulfilling_location_id = payload.fulfilling_location_id
    if payload.carrier is not None:
        order.carrier = payload.carrier
    if payload.tracking_number is not None:
        order.tracking_number = payload.tracking_number
    if payload.shipped_date is not None:
        order.shipped_date = payload.shipped_date
    if payload.estimated_arrival_date is not None:
        order.estimated_arrival_date = payload.estimated_arrival_date
    if payload.shipping_cost is not None:
        order.shipping_cost = payload.shipping_cost
    if payload.shipping_cost_currency is not None:
        order.shipping_cost_currency = payload.shipping_cost_currency
    if payload.atp_ship_date is not None:
        order.atp_ship_date = payload.atp_ship_date
    if payload.atp_delivery_date is not None:
        order.atp_delivery_date = payload.atp_delivery_date
    if payload.atp_feasible is not None:
        order.atp_feasible = payload.atp_feasible

    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/outbound-orders/{id}/issue
# ---------------------------------------------------------------------------

@router.post("/{order_id}/issue")
def issue_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition order from Draft to Issued (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if order.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot issue order in status '{order.status}'. Only Draft orders can be issued.",
        )

    order.status = "Issued"
    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/outbound-orders/{id}/allocate
# ---------------------------------------------------------------------------

@router.post("/{order_id}/allocate")
def allocate_order(
    order_id: int,
    payload: AllocatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allocate serials to an outbound order. Issued/Allocated → Allocated."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if order.status not in ("Issued", "Allocated"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot allocate order in status '{order.status}'. Order must be Issued or Allocated.",
        )

    # Look up AVAILABLE states
    available_states = (
        db.query(TerminalState)
        .filter(TerminalState.code.in_(["AVAILABLE", "AVAILABLE_REFURBISHED"]))
        .all()
    )
    available_state_ids = {s.id for s in available_states}

    for item in payload.allocations:
        # Verify serial exists and is available
        serial = (
            db.query(SerialNumber)
            .filter(SerialNumber.id == item.serial_id, SerialNumber.active == 1)
            .first()
        )
        if not serial:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial ID {item.serial_id} not found or inactive",
            )
        if serial.current_state_id not in available_state_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial {serial.serial_number} is not in an AVAILABLE state",
            )
        # Verify the serial belongs to the fulfilling location
        if order.fulfilling_location_id and serial.current_location_id != order.fulfilling_location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial {serial.serial_number} is not at the fulfilling location",
            )

        # Verify order_line_id belongs to this order
        line = (
            db.query(OutboundOrderLine)
            .filter(
                OutboundOrderLine.id == item.order_line_id,
                OutboundOrderLine.order_id == order_id,
            )
            .first()
        )
        if not line:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order line ID {item.order_line_id} not found on this order",
            )

        # Check not already allocated
        existing = (
            db.query(OutboundOrderSerial)
            .filter(
                OutboundOrderSerial.order_id == order_id,
                OutboundOrderSerial.serial_id == item.serial_id,
            )
            .first()
        )
        if existing:
            continue  # skip duplicates silently

        oos = OutboundOrderSerial(
            order_id=order_id,
            order_line_id=item.order_line_id,
            serial_id=item.serial_id,
        )
        db.add(oos)

    order.status = "Allocated"
    db.flush()

    # ── Auto-create / refresh Pick Work Order ──────────────────────────────
    # Cancel any existing open WO so we start fresh with the updated allocation.
    existing_wo = (
        db.query(WorkOrder)
        .filter(
            WorkOrder.outbound_order_id == order_id,
            WorkOrder.status.in_(["Open", "Acknowledged", "In Progress"]),
        )
        .first()
    )
    if existing_wo:
        existing_wo.status = "Cancelled"

    # Generate WO number
    wo_seq = db.query(OrderNumbering).filter(OrderNumbering.order_type == "WO").with_for_update().first()
    if wo_seq:
        wo_seq.current_sequence += 1
        wo_number = f"{wo_seq.prefix}{str(wo_seq.current_sequence).zfill(wo_seq.padding_length)}"
    else:
        wo_number = f"WO{order_id:06d}"

    new_wo = WorkOrder(
        order_number=wo_number,
        outbound_order_id=order_id,
        wo_type="Pick",
        status="Open",
        location_id=order.fulfilling_location_id,
        created_by_user_id=current_user.id,
    )
    db.add(new_wo)
    db.flush()

    # Create one WO line per allocated serial
    for oos in order.serials:
        wol = WorkOrderLine(
            work_order_id=new_wo.id,
            outbound_order_line_id=oos.order_line_id,
            allocated_serial_id=oos.serial_id,
        )
        db.add(wol)

    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/outbound-orders/{id}/ship
# ---------------------------------------------------------------------------

@router.post("/{order_id}/ship")
def ship_order(
    order_id: int,
    payload: ShipPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition order from Allocated to Shipped. Transition serials to TRANSIT state."""
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if order.status != "Allocated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot ship order in status '{order.status}'. Order must be Allocated.",
        )

    # Block shipping if there is an open Work Order
    open_wo = (
        db.query(WorkOrder)
        .filter(
            WorkOrder.outbound_order_id == order_id,
            WorkOrder.status.in_(["Open", "Acknowledged", "In Progress"]),
        )
        .first()
    )
    if open_wo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Work Order {open_wo.order_number} must be completed before shipping.",
        )

    # Determine target transit state
    if order.order_type == "Distribution":
        transit_code = "TRANSIT_TO_WAREHOUSE"
    else:
        transit_code = "TRANSIT_TO_COMPANY"

    transit_state = db.query(TerminalState).filter(TerminalState.code == transit_code).first()
    if not transit_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terminal state '{transit_code}' not found",
        )

    # Transition all allocated serials
    allocated_serials = [oos for oos in order.serials if oos.serial]
    n_serials = len(allocated_serials)
    cost_per_terminal = None
    if payload.shipping_cost and n_serials > 0:
        cost_per_terminal = round(payload.shipping_cost / n_serials, 4)

    for oos in allocated_serials:
        serial = oos.serial
        serial.current_state_id = transit_state.id
        if cost_per_terminal is not None:
            serial.accumulated_cost = (serial.accumulated_cost or 0) + cost_per_terminal
        history = StateHistory(
            serial_number_id=serial.id,
            state_id=transit_state.id,
            location_id=serial.current_location_id,
            timezone="UTC",
            actor_type="user",
            actor_user_id=current_user.id,
            activity_description=get_activity_description(transit_state.code),
            order_reference=order.order_number,
            notes=f"Shipped via Outbound Order {order.order_number}",
            activity_cost=cost_per_terminal if cost_per_terminal is not None else None,
            activity_cost_currency=payload.shipping_cost_currency if cost_per_terminal is not None else None,
        )
        db.add(history)

    # Update order shipment details
    if payload.carrier is not None:
        order.carrier = payload.carrier
    if payload.tracking_number is not None:
        order.tracking_number = payload.tracking_number
    if payload.shipped_date is not None:
        order.shipped_date = payload.shipped_date
    if payload.estimated_arrival_date is not None:
        order.estimated_arrival_date = payload.estimated_arrival_date
    if payload.shipping_cost is not None:
        order.shipping_cost = payload.shipping_cost
    if payload.shipping_cost_currency is not None:
        order.shipping_cost_currency = payload.shipping_cost_currency

    order.status = "Shipped"
    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# Helper: find or create a Location record for a Customer
# ---------------------------------------------------------------------------

def get_or_create_customer_location(db: Session, customer: Customer) -> int:
    """Return the Location.id for this customer, creating a new Location row if needed.
    Code = customer_ref, Name = 'Name, Region, Country'.
    """
    # Reuse existing location if already created for this customer
    existing = db.query(Location).filter(Location.code == customer.customer_ref).first()
    if existing:
        return existing.id

    # Find or create the "Customer" LocationType
    loc_type = db.query(LocationType).filter(LocationType.name == "Customer").first()
    if not loc_type:
        loc_type = LocationType(name="Customer", active=1)
        db.add(loc_type)
        db.flush()

    parts = [customer.name]
    if customer.state_region:
        parts.append(customer.state_region)
    if customer.country:
        parts.append(customer.country)

    new_loc = Location(
        code=customer.customer_ref,
        name=", ".join(parts),
        location_type_id=loc_type.id,
        country=customer.country or "XX",
        city=customer.state_region or customer.country or "",
        reporting_currency="EUR",
        active=1,
    )
    db.add(new_loc)
    db.flush()
    return new_loc.id


# ---------------------------------------------------------------------------
# POST /api/outbound-orders/{id}/deliver
# ---------------------------------------------------------------------------

@router.post("/{order_id}/deliver")
def deliver_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition order from Shipped to Delivered. Transition serials to RECEIVED."""
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if order.status != "Shipped":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deliver order in status '{order.status}'. Order must be Shipped.",
        )

    received_state = db.query(TerminalState).filter(TerminalState.code == "RECEIVED").first()
    if not received_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Terminal state 'RECEIVED' not found",
        )

    for oos in order.serials:
        serial = oos.serial
        if serial:
            # Update location to destination before recording history.
            # DS orders use destination_location_id (warehouse).
            # SO/RN/RP orders use a dynamically created customer Location.
            dest_loc_id = order.destination_location_id
            if not dest_loc_id and order.customer_id and order.customer:
                dest_loc_id = get_or_create_customer_location(db, order.customer)
            dest_loc_id = dest_loc_id or serial.current_location_id
            serial.current_location_id = dest_loc_id
            serial.current_state_id = received_state.id
            history = StateHistory(
                serial_number_id=serial.id,
                state_id=received_state.id,
                location_id=dest_loc_id,
                timezone="UTC",
                actor_type="user",
                actor_user_id=current_user.id,
                activity_description=get_activity_description(received_state.code),
                order_reference=order.order_number,
                notes=f"Delivered via Outbound Order {order.order_number}",
            )
            db.add(history)

    order.status = "Delivered"
    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/outbound-orders/{id}/cancel
# ---------------------------------------------------------------------------

@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel an outbound order (only if Draft, Issued, or Allocated)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbound order not found")

    if order.status not in ("Draft", "Issued", "Allocated"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order in status '{order.status}'. Only Draft, Issued, or Allocated orders can be cancelled.",
        )

    # Remove allocated serials (serial state remains AVAILABLE, no state change needed)
    for oos in list(order.serials):
        db.delete(oos)

    order.status = "Cancelled"
    db.commit()
    db.refresh(order)
    return order_to_out(order, include_lines=True)
