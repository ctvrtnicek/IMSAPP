"""
purchase_orders.py — Purchase Orders module router (Phase 1C).

All endpoints require authentication.
Prefix: /api/purchase-orders
"""

import os
import tempfile
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from document_processor import process_document
from routers.cost_engine import apply_cost
from state_activity_map import get_activity_description
from models import (
    InboundShipment,
    Location,
    OrderNumbering,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    SerialNumber,
    StateHistory,
    Supplier,
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
# POST /api/purchase-orders/{id}/extract-document
# ---------------------------------------------------------------------------

@router.post("/{po_id}/extract-document")
async def extract_document(
    po_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Best-effort extraction of serial numbers from an uploaded shipment
    document (packing list, delivery note, ...) — the supplier portal's
    "upload document" flow feeds the result into import-serials for review
    before confirming. Regex-based by default (no external dependencies);
    OCR/PDF support degrades gracefully if pytesseract/PyMuPDF aren't
    installed — extraction just finds nothing on those file types.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    data = await file.read()
    suffix = os.path.splitext(file.filename or "")[1]
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        result = process_document(tmp_path, file.content_type or "")
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return {
        "serials": result.serials,
        "shipment_reference": result.shipment_reference,
        "errors": result.errors,
        "provider_used": result.provider_used,
    }


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

    db.commit()

    return {"received": received_count, "po_status": new_status}


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
        }

    return [serial_to_out(s) for s in serials]
