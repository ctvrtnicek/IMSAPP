"""
purchase_orders.py — Purchase Orders module router (Phase 1C).

All endpoints require authentication.
Prefix: /api/purchase-orders
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from routers.cost_engine import apply_cost
from state_activity_map import get_activity_description
from models import (
    GoodsReceiptMessage,
    InboundShipment,
    Location,
    LocationType,
    OrderNumbering,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    SerialNumber,
    StateHistory,
    Supplier,
    SystemConfig,
    TerminalState,
    User,
)
from schemas import (
    POCreate,
    POOut,
    POUpdate,
    SerialImportPayload,
    SerialImportResult,
)

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


# ---------------------------------------------------------------------------
# Helper: generate PO number
# ---------------------------------------------------------------------------

def generate_po_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "PurchaseOrder").first()
    if not row:
        return "PO000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


# ---------------------------------------------------------------------------
# Helper: build POOut dict from ORM object
# ---------------------------------------------------------------------------

def po_line_to_out(line: PurchaseOrderLine) -> dict:
    return {
        "id": line.id,
        "line_number": line.line_number,
        "product_id": line.product_id,
        "product_code": line.product.code if line.product else None,
        "product_name": line.product.name if line.product else None,
        "qty_ordered": line.qty_ordered,
        "qty_expected": line.qty_expected,
        "qty_received": line.qty_received,
        "received_date": line.received_date,
        "price_per_product": line.price_per_product,
        "price_currency": line.price_currency,
    }


def po_to_out(po: PurchaseOrder, include_lines: bool = True) -> dict:
    result = {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_id": po.supplier_id,
        "supplier_name": po.supplier.name if po.supplier else None,
        "destination_location_id": po.destination_location_id,
        "destination_location_code": po.destination_location.code if po.destination_location else None,
        "destination_location_name": po.destination_location.name if po.destination_location else None,
        "order_date": po.order_date,
        "expected_arrival_date": po.expected_arrival_date,
        "received_date": po.received_date,
        "status": po.status,
        "notes": po.notes,
        "created_at": str(po.created_at) if po.created_at else None,
        "lines": [],
    }
    if include_lines and po.lines:
        result["lines"] = [po_line_to_out(line) for line in po.lines]
    return result


# ---------------------------------------------------------------------------
# Helper: recalculate PO status based on line quantities
# ---------------------------------------------------------------------------

def recalculate_po_status(po: PurchaseOrder) -> str:
    if not po.lines:
        return po.status
    total_ordered = sum(line.qty_ordered for line in po.lines)
    total_received = sum(line.qty_received for line in po.lines)
    if total_received == 0:
        return po.status  # no change if nothing received yet
    if total_received >= total_ordered:
        return "Fully Received"
    return "Partially Received"


# ---------------------------------------------------------------------------
# GET /api/purchase-orders
# ---------------------------------------------------------------------------

@router.get("")
def list_pos(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all purchase orders. Optional ?status= filter. Returns headers only (no lines)."""
    q = db.query(PurchaseOrder)
    if status_filter:
        q = q.filter(PurchaseOrder.status == status_filter)

    roles = getattr(current_user, "roles_list", [current_user.role])
    if "supplier" in roles and "admin" not in roles:
        if current_user.supplier_id:
            q = q.filter(PurchaseOrder.supplier_id == current_user.supplier_id)
        else:
            # Fallback: no supplier assigned — return empty
            q = q.filter(PurchaseOrder.id == -1)

    pos = q.order_by(PurchaseOrder.id.desc()).all()
    return [po_to_out(po, include_lines=False) for po in pos]


# ---------------------------------------------------------------------------
# POST /api/purchase-orders
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
def create_po(
    payload: POCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new Purchase Order (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    if not payload.lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one line is required")

    po_number = generate_po_number(db)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=payload.supplier_id,
        destination_location_id=payload.destination_location_id,
        order_date=payload.order_date,
        expected_arrival_date=payload.expected_arrival_date,
        status="Draft",
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(po)
    db.flush()  # get po.id

    for idx, line_payload in enumerate(payload.lines, start=1):
        line = PurchaseOrderLine(
            po_id=po.id,
            line_number=idx,
            product_id=line_payload.product_id,
            qty_ordered=line_payload.qty_ordered,
            qty_expected=0,
            qty_received=0,
            price_per_product=line_payload.price_per_product,
            price_currency=line_payload.price_currency,
        )
        db.add(line)

    db.commit()
    db.refresh(po)
    return po_to_out(po, include_lines=True)


# ---------------------------------------------------------------------------
# GET /api/purchase-orders/{id}
# ---------------------------------------------------------------------------

@router.get("/by-number/{po_number}")
def get_po_by_number(
    po_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single PO by PO number (for order reference links)."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_number).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po_to_out(po, include_lines=True)


@router.get("/{po_id}")
def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single PO with full lines."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po_to_out(po, include_lines=True)


# ---------------------------------------------------------------------------
# PUT /api/purchase-orders/{id}
# ---------------------------------------------------------------------------

@router.put("/{po_id}")
def update_po(
    po_id: int,
    payload: POUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update PO fields (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if payload.expected_arrival_date is not None:
        po.expected_arrival_date = payload.expected_arrival_date
    if payload.notes is not None:
        po.notes = payload.notes
    if payload.status is not None:
        po.status = payload.status

    db.commit()
    db.refresh(po)
    return po_to_out(po, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/issue
# ---------------------------------------------------------------------------

@router.post("/{po_id}/issue")
def issue_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change PO status from Draft to Issued (supply_planner or admin only)."""
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="supply_planner or admin only")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    if po.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot issue PO in status '{po.status}'. Only Draft POs can be issued.",
        )

    po.status = "Issued"
    db.commit()
    db.refresh(po)
    return po_to_out(po, include_lines=True)


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/import-serials
# ---------------------------------------------------------------------------

@router.post("/{po_id}/import-serials")
def import_serials(
    po_id: int,
    payload: SerialImportPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import serial numbers against a PO. Creates SerialNumber + StateHistory records."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    # Look up EXPECTING state
    expecting_state = db.query(TerminalState).filter(TerminalState.code == "EXPECTING").first()
    if not expecting_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="EXPECTING state not found in terminal_states table",
        )

    total = len(payload.serials)
    created = 0
    duplicates = 0
    errors: list[str] = []

    for row in payload.serials:
        serial_str = row.serial_number.strip()
        product_code_str = row.product_code.strip()

        if not serial_str or not product_code_str:
            errors.append(f"Empty serial or product_code in row: '{row.serial_number},{row.product_code}'")
            continue

        # Look up product
        product = db.query(Product).filter(Product.code == product_code_str).first()
        if not product:
            errors.append(f"Product not found: '{product_code_str}' (serial: '{serial_str}')")
            continue

        # Check duplicate: same serial_number + supplier_id combo
        existing = (
            db.query(SerialNumber)
            .filter(
                SerialNumber.serial_number == serial_str,
                SerialNumber.supplier_id == po.supplier_id,
            )
            .first()
        )
        if existing:
            duplicates += 1
            continue

        # Create SerialNumber in EXPECTING state
        new_serial = SerialNumber(
            serial_number=serial_str,
            supplier_id=po.supplier_id,
            product_id=product.id,
            current_state_id=expecting_state.id,
            current_location_id=po.destination_location_id,
            stock_type="Live",
            security_seal=0,
            key_loaded=0,
            po_id=po.id,
            active=1,
            accumulated_cost=0,
            shipment_reference=payload.shipment_reference,
            carrier=payload.carrier,
        )
        db.add(new_serial)
        db.flush()  # get new_serial.id

        # Create StateHistory record
        history = StateHistory(
            serial_number_id=new_serial.id,
            state_id=expecting_state.id,
            location_id=po.destination_location_id,
            timezone="UTC",
            actor_type="user",
            actor_user_id=current_user.id,
            activity_description=get_activity_description(expecting_state.code),
            order_reference=po.po_number,
        )
        db.add(history)

        # Increment qty_expected on matching PO line
        po_line = (
            db.query(PurchaseOrderLine)
            .filter(
                PurchaseOrderLine.po_id == po.id,
                PurchaseOrderLine.product_id == product.id,
            )
            .first()
        )
        if po_line:
            po_line.qty_expected += 1

        created += 1

    # Create InboundShipment record
    shipment = InboundShipment(
        po_id=po.id,
        shipment_reference=payload.shipment_reference,
        carrier=payload.carrier,
        carrier_tracking_ref=payload.carrier_tracking_ref,
        estimated_arrival_date=payload.estimated_arrival_date,
        uploaded_by_user_id=current_user.id,
    )
    db.add(shipment)

    # Update PO status to "Expected" if it was "Issued" or "Draft"
    if po.status in ("Issued", "Draft") and created > 0:
        po.status = "Expected"

    db.commit()

    return SerialImportResult(
        total=total,
        created=created,
        duplicates=duplicates,
        errors=errors,
    )


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/receive-all
# ---------------------------------------------------------------------------

@router.post("/{po_id}/receive-all")
def receive_all(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm receipt of all EXPECTING serials on this PO (EXPECTING -> QUARANTINE)."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    expecting_state = db.query(TerminalState).filter(TerminalState.code == "EXPECTING").first()
    quarantine_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE").first()

    if not expecting_state or not quarantine_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Required terminal states (EXPECTING, QUARANTINE) not found",
        )

    # Find all serials linked to this PO in EXPECTING state
    serials = (
        db.query(SerialNumber)
        .filter(
            SerialNumber.po_id == po_id,
            SerialNumber.current_state_id == expecting_state.id,
            SerialNumber.active == 1,
        )
        .all()
    )

    received_count = 0
    for s in serials:
        # Transition to QUARANTINE
        s.current_state_id = quarantine_state.id

        # Create StateHistory record
        history = StateHistory(
            serial_number_id=s.id,
            state_id=quarantine_state.id,
            location_id=s.current_location_id,
            timezone="UTC",
            actor_type="user",
            actor_user_id=current_user.id,
            activity_description=get_activity_description(quarantine_state.code),
            order_reference=po.po_number,
        )
        db.add(history)

        if s.current_location_id:
            apply_cost(db, s, history, quarantine_state.code, s.current_location_id)

        # Increment qty_received on matching PO line
        po_line = (
            db.query(PurchaseOrderLine)
            .filter(
                PurchaseOrderLine.po_id == po_id,
                PurchaseOrderLine.product_id == s.product_id,
            )
            .first()
        )
        if po_line:
            po_line.qty_received += 1
            if not po_line.received_date:
                po_line.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        received_count += 1

    # Set PO-level received_date on first receipt
    if received_count > 0 and not po.received_date:
        po.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    db.flush()

    # Recalculate PO status
    db.refresh(po)
    new_status = recalculate_po_status(po)
    po.status = new_status

    # Generate GR message if enabled and location type is gr_applicable
    if received_count > 0:
        gr_enabled_cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "GR_OUTBOUND_MESSAGE_ENABLED").first()
        if gr_enabled_cfg and gr_enabled_cfg.current_value in ("1", "true"):
            dest_loc = db.query(Location).filter(Location.id == po.destination_location_id).first()
            if dest_loc and dest_loc.location_type and dest_loc.location_type.gr_applicable == 1:
                gr_msg = GoodsReceiptMessage(
                    po_id=po.id,
                    location_id=po.destination_location_id,
                    message_type="GOODS_RECEIPT",
                    serial_count=received_count,
                    created_by_user_id=current_user.id,
                )
                db.add(gr_msg)

    db.commit()

    return {"received": received_count, "po_status": new_status}


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/receive-dialog
# ---------------------------------------------------------------------------

from pydantic import BaseModel as PydanticBaseModel


class ReceiveSerialItem(PydanticBaseModel):
    serial_id: int
    state_code: str = "QUARANTINE"  # QUARANTINE or QUALITY_HOLD


class ReceiveDialogPayload(PydanticBaseModel):
    items: List[ReceiveSerialItem]


@router.post("/{po_id}/receive-dialog")
def receive_dialog(
    po_id: int,
    payload: ReceiveDialogPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Receive serials with per-serial state selection (QUARANTINE or QUALITY_HOLD)."""
    ALLOWED_RECEIVE_STATES = {"QUARANTINE", "QUALITY_HOLD"}
    ALLOWED_RECEIVE_ROLES = {"admin", "supply_planner", "warehouse_user", "supplier", "repair_centre", "inbound_specialist", "rma_manager"}

    roles = getattr(current_user, "roles_list", [current_user.role])
    if not any(r in ALLOWED_RECEIVE_ROLES for r in roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to receive PO serials")

    for item in payload.items:
        if item.state_code not in ALLOWED_RECEIVE_STATES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid state_code '{item.state_code}'. Must be QUARANTINE or QUALITY_HOLD")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO not found")

    received_count = 0
    quality_hold_serials = []

    for item in payload.items:
        s = db.query(SerialNumber).filter(SerialNumber.id == item.serial_id, SerialNumber.active == 1).first()
        if not s:
            continue

        expecting_state = db.query(TerminalState).filter(TerminalState.code == "EXPECTING").first()
        if not expecting_state or s.current_state_id != expecting_state.id:
            continue

        target_state = db.query(TerminalState).filter(TerminalState.code == item.state_code).first()
        if not target_state:
            continue

        s.current_state_id = target_state.id

        history = StateHistory(
            serial_number_id=s.id,
            state_id=target_state.id,
            location_id=s.current_location_id,
            timezone="UTC",
            actor_type="user",
            actor_user_id=current_user.id,
            activity_description=get_activity_description(target_state.code),
            order_reference=po.po_number,
        )
        db.add(history)

        if s.current_location_id:
            apply_cost(db, s, history, target_state.code, s.current_location_id)

        # Increment qty_received on matching PO line
        po_line = db.query(PurchaseOrderLine).filter(
            PurchaseOrderLine.po_id == po_id,
            PurchaseOrderLine.product_id == s.product_id,
        ).first()
        if po_line:
            po_line.qty_received += 1
            if not po_line.received_date:
                po_line.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        received_count += 1

        if item.state_code == "QUALITY_HOLD":
            quality_hold_serials.append(s)

    # Set PO-level received_date
    if received_count > 0 and not po.received_date:
        po.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    db.flush()
    db.refresh(po)
    new_status = recalculate_po_status(po)
    po.status = new_status

    # Raise Quality Hold alerts
    if quality_hold_serials:
        from models import AlertRule, Alert
        qh_rule = db.query(AlertRule).filter(AlertRule.rule_code == "QUALITY_HOLD_RAISED").first()
        if qh_rule and qh_rule.enabled:
            serial_refs = ", ".join(s.serial_number for s in quality_hold_serials)
            alert = Alert(
                rule_id=qh_rule.id,
                severity="Urgent",
                status="New",
                reference_id=po.id,
                reference_type="purchase_order",
                message=f"Quality Hold on PO {po.po_number}: {len(quality_hold_serials)} serial(s) placed in Quality Hold ({serial_refs})",
                location_id=po.destination_location_id,
            )
            db.add(alert)

    db.commit()
    return {"received": received_count, "quality_hold": len(quality_hold_serials), "po_status": new_status}


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/reverse-receive
# ---------------------------------------------------------------------------

@router.post("/{po_id}/reverse-receive")
def reverse_receive(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reverse receipt of all QUARANTINE serials on this PO (QUARANTINE -> EXPECTING). Admin only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    expecting_state = db.query(TerminalState).filter(TerminalState.code == "EXPECTING").first()
    quarantine_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE").first()

    if not expecting_state or not quarantine_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Required terminal states (EXPECTING, QUARANTINE) not found",
        )

    # Find all serials linked to this PO in QUARANTINE state
    serials = (
        db.query(SerialNumber)
        .filter(
            SerialNumber.po_id == po_id,
            SerialNumber.current_state_id == quarantine_state.id,
            SerialNumber.active == 1,
        )
        .all()
    )

    reversed_count = 0
    for s in serials:
        # Transition back to EXPECTING
        s.current_state_id = expecting_state.id

        # Create StateHistory record for reversal
        history = StateHistory(
            serial_number_id=s.id,
            state_id=expecting_state.id,
            location_id=s.current_location_id,
            timezone="UTC",
            actor_type="user",
            actor_user_id=current_user.id,
            activity_description="Reverse Goods Receipt — reverted to Expecting",
            order_reference=po.po_number,
        )
        db.add(history)

        # Decrement qty_received on matching PO line
        po_line = (
            db.query(PurchaseOrderLine)
            .filter(
                PurchaseOrderLine.po_id == po_id,
                PurchaseOrderLine.product_id == s.product_id,
            )
            .first()
        )
        if po_line and po_line.qty_received > 0:
            po_line.qty_received -= 1

        reversed_count += 1

    db.flush()

    # Recalculate PO status
    db.refresh(po)
    total_received = sum(line.qty_received for line in po.lines)
    if total_received == 0:
        po.status = "Expected"
        po.received_date = None
    else:
        total_ordered = sum(line.qty_ordered for line in po.lines)
        po.status = "Fully Received" if total_received >= total_ordered else "Partially Received"

    # Generate Reverse GR message if enabled and location type is gr_applicable
    if reversed_count > 0:
        gr_enabled_cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "GR_OUTBOUND_MESSAGE_ENABLED").first()
        if gr_enabled_cfg and gr_enabled_cfg.current_value in ("1", "true"):
            dest_loc = db.query(Location).filter(Location.id == po.destination_location_id).first()
            if dest_loc and dest_loc.location_type and dest_loc.location_type.gr_applicable == 1:
                gr_msg = GoodsReceiptMessage(
                    po_id=po.id,
                    location_id=po.destination_location_id,
                    message_type="REVERSE_GOODS_RECEIPT",
                    serial_count=reversed_count,
                    created_by_user_id=current_user.id,
                )
                db.add(gr_msg)

    db.commit()

    return {"reversed": reversed_count, "po_status": po.status}


# ---------------------------------------------------------------------------
# POST /api/purchase-orders/{id}/receive-serial/{serial_id}
# ---------------------------------------------------------------------------

@router.post("/{po_id}/receive-serial/{serial_id}")
def receive_serial(
    po_id: int,
    serial_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Receive a single serial number (EXPECTING -> QUARANTINE)."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    s = db.query(SerialNumber).filter(SerialNumber.id == serial_id, SerialNumber.active == 1).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Serial number not found")

    if s.po_id != po_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial number does not belong to this PO",
        )

    expecting_state = db.query(TerminalState).filter(TerminalState.code == "EXPECTING").first()
    quarantine_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE").first()

    if not expecting_state or not quarantine_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Required terminal states not found",
        )

    if s.current_state_id != expecting_state.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial is not in EXPECTING state",
        )

    # Transition to QUARANTINE
    s.current_state_id = quarantine_state.id

    history = StateHistory(
        serial_number_id=s.id,
        state_id=quarantine_state.id,
        location_id=s.current_location_id,
        timezone="UTC",
        actor_type="user",
        actor_user_id=current_user.id,
        activity_description=get_activity_description(quarantine_state.code),
        order_reference=po.po_number,
    )
    db.add(history)

    if s.current_location_id:
        apply_cost(db, s, history, quarantine_state.code, s.current_location_id)

    # Increment qty_received on matching PO line
    po_line = (
        db.query(PurchaseOrderLine)
        .filter(
            PurchaseOrderLine.po_id == po_id,
            PurchaseOrderLine.product_id == s.product_id,
        )
        .first()
    )
    if po_line:
        po_line.qty_received += 1
        if not po_line.received_date:
            po_line.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    # Set PO-level received_date on first receipt
    if not po.received_date:
        po.received_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    db.flush()

    # Recalculate PO status
    db.refresh(po)
    new_status = recalculate_po_status(po)
    po.status = new_status

    db.commit()

    return {"received": 1, "po_status": new_status}


# ---------------------------------------------------------------------------
# GET /api/purchase-orders/{id}/serials
# ---------------------------------------------------------------------------

@router.get("/{po_id}/serials")
def get_po_serials(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all serial numbers linked to this PO."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    serials = (
        db.query(SerialNumber)
        .filter(SerialNumber.po_id == po_id, SerialNumber.active == 1)
        .all()
    )

    def serial_to_out(s: SerialNumber) -> dict:
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
            "created_at": str(s.created_at) if s.created_at else None,
            "shipment_reference": s.shipment_reference,
            "carrier": s.carrier,
        }

    return [serial_to_out(s) for s in serials]


# ---------------------------------------------------------------------------
# Phase 3E — Document upload for serial extraction
# ---------------------------------------------------------------------------
import os
import shutil

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "upload_files")
os.makedirs(UPLOAD_DIR, exist_ok=True)


ALLOWED_UPLOAD_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.xls', '.xlsx', '.csv', '.txt'}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/{po_id}/upload-document")
async def upload_document_for_extraction(
    po_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a document for OCR/AI extraction of serial numbers."""
    ALLOWED_ROLES = {"admin", "supply_planner", "warehouse_user", "supplier", "inbound_specialist"}
    roles = getattr(current_user, "roles_list", [current_user.role])
    if not any(r in ALLOWED_ROLES for r in roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for document upload")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed. Accepted: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"File too large. Maximum {MAX_UPLOAD_SIZE // (1024*1024)}MB.")

    from document_processor import process_document

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")

    enabled_cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "AI_DOCUMENT_PROCESSOR_ENABLED").first()
    if not enabled_cfg or enabled_cfg.current_value not in ("1", "true"):
        raise HTTPException(400, "Document processor is disabled. Enable in Admin → System Config.")

    provider_cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "DOCUMENT_PROCESSOR_PROVIDER").first()
    provider = provider_cfg.current_value if provider_cfg else "regex"

    api_key = None
    if provider == "claude_api":
        key_cfg = db.query(SystemConfig).filter(SystemConfig.config_key == "ANTHROPIC_API_KEY").first()
        api_key = key_cfg.current_value if key_cfg else None

    safe_name = f"po{po_id}_{os.path.basename(file.filename).replace(' ', '_')}"
    dest = os.path.join(UPLOAD_DIR, safe_name)
    with open(dest, "wb") as f_out:
        f_out.write(contents)

    result = process_document(dest, file.content_type, provider, api_key)

    try:
        os.remove(dest)
    except OSError:
        pass

    return {
        "provider": result.provider_used,
        "serials": result.serials,
        "shipment_reference": result.shipment_reference,
        "errors": result.errors,
        "raw_text_preview": result.raw_text[:500] if result.raw_text else "",
    }
