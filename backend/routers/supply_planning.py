"""
supply_planning.py — Supply Planning + Repositioning router (Phase 2I).
Prefix: /api/supply
"""
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    DemandSignal,
    Location,
    NonSerialisedInventory,
    OrderNumbering,
    OutboundOrder,
    OutboundOrderLine,
    Product,
    ProductSupplier,
    PurchaseOrder,
    PurchaseOrderLine,
    SafetyStockTarget,
    SerialNumber,
    Supplier,
    TerminalState,
    TransitTimeFallback,
    TransitTimeLane,
    User,
)

router = APIRouter(prefix="/api/supply", tags=["supply"])

PLANNER_ROLES = {"admin", "supply_planner", "demand_planner"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TargetCreate(BaseModel):
    product_id: int
    location_id: int
    min_qty: int = 0
    reorder_point: int = 0
    reorder_qty: int = 0
    notes: Optional[str] = None


class TargetUpdate(BaseModel):
    min_qty: Optional[int] = None
    reorder_point: Optional[int] = None
    reorder_qty: Optional[int] = None
    notes: Optional[str] = None


class RepositionCreate(BaseModel):
    product_id: int
    from_location_id: int
    to_location_id: int
    quantity: int
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _target_out(t: SafetyStockTarget) -> dict:
    return {
        "id": t.id,
        "product_id": t.product_id,
        "product_code": t.product.code if t.product else None,
        "product_name": t.product.name if t.product else None,
        "location_id": t.location_id,
        "location_code": t.location.code if t.location else None,
        "location_name": t.location.name if t.location else None,
        "min_qty": t.min_qty,
        "reorder_point": t.reorder_point,
        "reorder_qty": t.reorder_qty,
        "notes": t.notes,
        "created_by_username": t.created_by.username if t.created_by else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


AVAILABLE_STATE_CODES = {"AVAILABLE", "AVAILABLE_REFURBISHED"}


def _get_available_state_ids(db: Session):
    states = db.query(TerminalState).filter(
        TerminalState.code.in_(AVAILABLE_STATE_CODES)
    ).all()
    return [s.id for s in states]


def _available_stock_for(product: Product, location_id: int, db: Session) -> int:
    """Count only AVAILABLE / AVAILABLE_REFURBISHED stock at a location."""
    if product.serialised:
        avail_ids = _get_available_state_ids(db)
        return db.query(func.count(SerialNumber.id)).filter(
            SerialNumber.product_id == product.id,
            SerialNumber.current_location_id == location_id,
            SerialNumber.current_state_id.in_(avail_ids),
            SerialNumber.active == 1,
        ).scalar() or 0
    else:
        return db.query(func.sum(NonSerialisedInventory.quantity)).filter(
            NonSerialisedInventory.product_id == product.id,
            NonSerialisedInventory.location_id == location_id,
        ).scalar() or 0


def _total_stock_for(product: Product, location_id: int, db: Session) -> int:
    """Count ALL active serials regardless of state."""
    if product.serialised:
        return db.query(func.count(SerialNumber.id)).filter(
            SerialNumber.product_id == product.id,
            SerialNumber.current_location_id == location_id,
            SerialNumber.active == 1,
        ).scalar() or 0
    else:
        return db.query(func.sum(NonSerialisedInventory.quantity)).filter(
            NonSerialisedInventory.product_id == product.id,
            NonSerialisedInventory.location_id == location_id,
        ).scalar() or 0


def _replan_status(stock: int, reorder_point: int, min_qty: int) -> str:
    if stock <= min_qty:
        return "Critical"
    if stock <= reorder_point:
        return "Reorder"
    return "OK"


def _generate_ds_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(
        OrderNumbering.order_type == "DistributionOrder"
    ).first()
    if not row:
        return "DS000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


# ---------------------------------------------------------------------------
# Safety Stock Targets — CRUD
# ---------------------------------------------------------------------------

@router.get("/targets")
def list_targets(
    product_id: Optional[int] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(SafetyStockTarget)
    if product_id:
        q = q.filter(SafetyStockTarget.product_id == product_id)
    if location_id:
        q = q.filter(SafetyStockTarget.location_id == location_id)
    return [_target_out(t) for t in q.order_by(SafetyStockTarget.location_id, SafetyStockTarget.product_id).all()]


@router.post("/targets")
def create_target(
    body: TargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    existing = db.query(SafetyStockTarget).filter(
        SafetyStockTarget.product_id == body.product_id,
        SafetyStockTarget.location_id == body.location_id,
    ).first()
    if existing:
        raise HTTPException(400, "A target already exists for this product + location. Edit it instead.")
    target = SafetyStockTarget(
        product_id=body.product_id,
        location_id=body.location_id,
        min_qty=body.min_qty,
        reorder_point=body.reorder_point,
        reorder_qty=body.reorder_qty,
        notes=body.notes,
        created_by_user_id=current_user.id,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return _target_out(target)


@router.put("/targets/{target_id}")
def update_target(
    target_id: int,
    body: TargetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    target = db.query(SafetyStockTarget).filter(SafetyStockTarget.id == target_id).first()
    if not target:
        raise HTTPException(404, "Target not found")
    if body.min_qty is not None:
        target.min_qty = body.min_qty
    if body.reorder_point is not None:
        target.reorder_point = body.reorder_point
    if body.reorder_qty is not None:
        target.reorder_qty = body.reorder_qty
    if body.notes is not None:
        target.notes = body.notes
    target.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(target)
    return _target_out(target)


@router.delete("/targets/{target_id}")
def delete_target(
    target_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    target = db.query(SafetyStockTarget).filter(SafetyStockTarget.id == target_id).first()
    if not target:
        raise HTTPException(404, "Target not found")
    db.delete(target)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Replenishment Planner — stock vs targets
# ---------------------------------------------------------------------------

@router.get("/replenishment")
def get_replenishment_plan(
    location_id: Optional[int] = None,
    status_filter: Optional[str] = None,   # OK | Reorder | Critical
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(SafetyStockTarget)
    if location_id:
        q = q.filter(SafetyStockTarget.location_id == location_id)
    targets = q.order_by(SafetyStockTarget.location_id, SafetyStockTarget.product_id).all()

    from datetime import date as _date
    today = _date.today()
    month_starts = []
    for i in range(1, 4):
        m = today.month + i
        y = today.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        month_starts.append(f"{y}-{m:02d}-01")

    rows = []
    for t in targets:
        stock = _total_stock_for(t.product, t.location_id, db)
        available = _available_stock_for(t.product, t.location_id, db)
        st = _replan_status(stock, t.reorder_point, t.min_qty)
        if status_filter and st != status_filter:
            continue

        # Pending Purchase Orders for this product (Draft/Issued) destined for this location
        po_links = (
            db.query(PurchaseOrder)
            .join(PurchaseOrderLine, PurchaseOrderLine.po_id == PurchaseOrder.id)
            .filter(
                PurchaseOrderLine.product_id == t.product_id,
                PurchaseOrder.destination_location_id == t.location_id,
                PurchaseOrder.status.in_(["Draft", "Issued", "Expected"]),
            )
            .all()
        )

        # Pending Distribution Orders (Draft/Processing) for this product → this location
        do_links = (
            db.query(OutboundOrder)
            .join(OutboundOrderLine, OutboundOrderLine.order_id == OutboundOrder.id)
            .filter(
                OutboundOrderLine.product_id == t.product_id,
                OutboundOrder.destination_location_id == t.location_id,
                OutboundOrder.order_type == "Distribution",
                OutboundOrder.status.in_(["Draft", "Processing", "Pending"]),
            )
            .all()
        )

        fc_signals = db.query(DemandSignal).filter(
            DemandSignal.product_id == t.product_id,
            DemandSignal.period_date.in_(month_starts),
        ).filter(
            (DemandSignal.location_id == t.location_id) | (DemandSignal.location_id == None)
        ).all()
        fc_map = {f.period_date: f.quantity for f in fc_signals}
        forecasts_out = [{"period_date": ms, "demand_qty": fc_map.get(ms)} for ms in month_starts]

        rows.append({
            "target_id": t.id,
            "product_id": t.product_id,
            "product_code": t.product.code if t.product else None,
            "product_name": t.product.name if t.product else None,
            "location_id": t.location_id,
            "location_code": t.location.code if t.location else None,
            "location_name": t.location.name if t.location else None,
            "min_qty": t.min_qty,
            "reorder_point": t.reorder_point,
            "reorder_qty": t.reorder_qty,
            "stock_qty": stock,
            "available_qty": available,
            "gap": stock - t.reorder_point,
            "status": st,
            "forecasts": forecasts_out,
            "pending_pos": [
                {"id": po.id, "po_number": po.po_number, "status": po.status}
                for po in po_links
            ],
            "pending_distributions": [
                {"id": do.id, "order_number": do.order_number, "status": do.status}
                for do in do_links
            ],
        })
    return rows


# ---------------------------------------------------------------------------
# Repositioning — create a Distribution Order to move stock
# ---------------------------------------------------------------------------

@router.post("/reposition")
def create_reposition(
    body: RepositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")

    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    from_loc = db.query(Location).filter(Location.id == body.from_location_id).first()
    to_loc = db.query(Location).filter(Location.id == body.to_location_id).first()
    if not from_loc or not to_loc:
        raise HTTPException(404, "Location not found")
    if body.from_location_id == body.to_location_id:
        raise HTTPException(400, "Origin and destination must be different")
    if body.quantity < 1:
        raise HTTPException(400, "Quantity must be at least 1")

    # Check available stock at origin
    available = _available_stock_for(product, body.from_location_id, db)
    if available < body.quantity:
        raise HTTPException(400, f"Insufficient stock at {from_loc.code}: {available} available, {body.quantity} requested")

    order_number = _generate_ds_number(db)
    order = OutboundOrder(
        order_number=order_number,
        order_type="Distribution",
        status="Draft",
        destination_location_id=body.to_location_id,
        fulfilling_location_id=body.from_location_id,
        created_by_user_id=current_user.id,
    )
    db.add(order)
    db.flush()

    line = OutboundOrderLine(
        order_id=order.id,
        line_number=1,
        product_id=body.product_id,
        quantity=body.quantity,
    )
    db.add(line)
    db.commit()
    db.refresh(order)

    return {
        "ok": True,
        "order_number": order.order_number,
        "order_id": order.id,
        "message": f"Distribution order {order.order_number} created: {body.quantity}× {product.code} from {from_loc.code} to {to_loc.code}",
    }


# ---------------------------------------------------------------------------
# Suggest best source location for a reposition
# ---------------------------------------------------------------------------

@router.get("/suggest-source")
def suggest_source(
    product_id: int,
    to_location_id: int,
    quantity: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns candidate source locations for repositioning, sorted by:
    1. Shortest lead time to destination (transit_time_lanes, min across modes)
    2. Fallback lead time if no lane exists
    3. Only locations with enough stock to cover the requested quantity
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    # Get fallback lead time
    fallback_row = db.query(TransitTimeFallback).first()
    fallback_days = fallback_row.lead_time_days if fallback_row else 14

    # All active locations except destination
    all_locations = db.query(Location).filter(
        Location.active == 1,
        Location.id != to_location_id,
    ).all()

    candidates = []
    for loc in all_locations:
        stock = _available_stock_for(product, loc.id, db)
        if stock < quantity:
            continue  # not enough stock

        # Find shortest lead time lane to destination
        lane = db.query(TransitTimeLane).filter(
            TransitTimeLane.from_location_id == loc.id,
            TransitTimeLane.to_location_id == to_location_id,
        ).order_by(TransitTimeLane.lead_time_days).first()

        lead_time = lane.lead_time_days if lane else None

        candidates.append({
            "location_id": loc.id,
            "location_code": loc.code,
            "location_name": loc.name,
            "stock_qty": stock,
            "lead_time_days": lead_time,
            "lead_time_source": "lane" if lane else "fallback",
            "sort_key": lead_time if lead_time is not None else fallback_days,
        })

    # Sort: known lead times first (ascending), then fallback ones
    candidates.sort(key=lambda c: (c["lead_time_days"] is None, c["sort_key"]))
    # Remove internal sort_key before returning
    for c in candidates:
        del c["sort_key"]

    return candidates


# ---------------------------------------------------------------------------
# Product-Supplier associations
# ---------------------------------------------------------------------------

class ProductSupplierIn(BaseModel):
    supplier_id: int
    lead_time_days: Optional[int] = None


@router.get("/product-suppliers/{product_id}")
def get_product_suppliers(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(ProductSupplier).filter(ProductSupplier.product_id == product_id).all()
    return [
        {
            "product_id": r.product_id,
            "supplier_id": r.supplier_id,
            "supplier_code": r.supplier.code if r.supplier else None,
            "supplier_name": r.supplier.name if r.supplier else None,
            "lead_time_days": r.lead_time_days,
        }
        for r in rows
    ]


@router.post("/product-suppliers/{product_id}")
def add_product_supplier(
    product_id: int,
    body: ProductSupplierIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    existing = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product_id,
        ProductSupplier.supplier_id == body.supplier_id,
    ).first()
    if existing:
        raise HTTPException(400, "This supplier is already linked to the product")
    ps = ProductSupplier(
        product_id=product_id,
        supplier_id=body.supplier_id,
        lead_time_days=body.lead_time_days,
    )
    db.add(ps)
    db.commit()
    db.refresh(ps)
    return {
        "product_id": ps.product_id,
        "supplier_id": ps.supplier_id,
        "supplier_code": ps.supplier.code if ps.supplier else None,
        "supplier_name": ps.supplier.name if ps.supplier else None,
        "lead_time_days": ps.lead_time_days,
    }


@router.put("/product-suppliers/{product_id}/{supplier_id}")
def update_product_supplier(
    product_id: int,
    supplier_id: int,
    body: ProductSupplierIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    ps = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product_id,
        ProductSupplier.supplier_id == supplier_id,
    ).first()
    if not ps:
        raise HTTPException(404, "Association not found")
    ps.lead_time_days = body.lead_time_days
    db.commit()
    return {
        "product_id": ps.product_id,
        "supplier_id": ps.supplier_id,
        "supplier_code": ps.supplier.code if ps.supplier else None,
        "supplier_name": ps.supplier.name if ps.supplier else None,
        "lead_time_days": ps.lead_time_days,
    }


@router.delete("/product-suppliers/{product_id}/{supplier_id}")
def remove_product_supplier(
    product_id: int,
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    ps = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product_id,
        ProductSupplier.supplier_id == supplier_id,
    ).first()
    if not ps:
        raise HTTPException(404, "Association not found")
    db.delete(ps)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Transit Time Lanes
# ---------------------------------------------------------------------------

class TransitLaneIn(BaseModel):
    from_location_id: int
    to_location_id: int
    transport_mode: str = "Road"
    lead_time_days: int

def _lane_out(l):
    return {
        "id": l.id,
        "from_location_id": l.from_location_id,
        "from_location_code": l.from_location.code if l.from_location else None,
        "from_location_name": l.from_location.name if l.from_location else None,
        "to_location_id": l.to_location_id,
        "to_location_code": l.to_location.code if l.to_location else None,
        "to_location_name": l.to_location.name if l.to_location else None,
        "transport_mode": l.transport_mode,
        "lead_time_days": l.lead_time_days,
    }

@router.get("/transit-lanes")
def list_transit_lanes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lanes = db.query(TransitTimeLane).order_by(TransitTimeLane.from_location_id, TransitTimeLane.to_location_id).all()
    return [_lane_out(l) for l in lanes]

@router.post("/transit-lanes")
def create_transit_lane(body: TransitLaneIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    if body.from_location_id == body.to_location_id:
        raise HTTPException(400, "Origin and destination must be different")
    lane = TransitTimeLane(from_location_id=body.from_location_id, to_location_id=body.to_location_id, transport_mode=body.transport_mode, lead_time_days=body.lead_time_days)
    db.add(lane); db.commit(); db.refresh(lane)
    return _lane_out(lane)

@router.put("/transit-lanes/{lane_id}")
def update_transit_lane(lane_id: int, body: TransitLaneIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    lane = db.query(TransitTimeLane).filter(TransitTimeLane.id == lane_id).first()
    if not lane:
        raise HTTPException(404, "Lane not found")
    lane.from_location_id = body.from_location_id; lane.to_location_id = body.to_location_id
    lane.transport_mode = body.transport_mode; lane.lead_time_days = body.lead_time_days
    db.commit(); db.refresh(lane)
    return _lane_out(lane)

@router.delete("/transit-lanes/{lane_id}")
def delete_transit_lane(lane_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {"admin", "supply_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    lane = db.query(TransitTimeLane).filter(TransitTimeLane.id == lane_id).first()
    if not lane:
        raise HTTPException(404, "Lane not found")
    db.delete(lane); db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Purchase Requisition — create Draft PO from best supplier
# ---------------------------------------------------------------------------

class PurchaseRequisitionIn(BaseModel):
    product_id: int
    location_id: int       # destination (the warehouse that needs stock)
    quantity: int
    notes: Optional[str] = None


@router.post("/purchase-requisition")
def create_purchase_requisition(
    body: PurchaseRequisitionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    if body.quantity < 1:
        raise HTTPException(400, "Quantity must be at least 1")

    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    location = db.query(Location).filter(Location.id == body.location_id).first()
    if not location:
        raise HTTPException(404, "Location not found")

    # Find suppliers for this product, sorted by lead_time_days (nulls last)
    ps_rows = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == body.product_id,
    ).all()
    if not ps_rows:
        raise HTTPException(400, f"No suppliers linked to product {product.code}. Add suppliers in Admin → Products first.")

    # Sort: known lead time ascending, then nulls
    ps_rows.sort(key=lambda r: (r.lead_time_days is None, r.lead_time_days or 0))
    best = ps_rows[0]

    # Generate PO number
    po_row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "PurchaseOrder").first()
    if not po_row:
        raise HTTPException(500, "OrderNumbering entry for PurchaseOrder not found")
    po_row.current_sequence += 1
    db.flush()
    po_number = f"{po_row.prefix}{str(po_row.current_sequence).zfill(po_row.padding_length)}"

    today = date.today().isoformat()
    expected = None
    if best.lead_time_days:
        from datetime import timedelta
        expected = (date.today() + timedelta(days=best.lead_time_days)).isoformat()

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=best.supplier_id,
        destination_location_id=body.location_id,
        order_date=today,
        expected_arrival_date=expected,
        status="Draft",
        notes=body.notes or f"Auto-generated purchase requisition for {product.code}",
        created_by_user_id=current_user.id,
    )
    db.add(po)
    db.flush()

    line = PurchaseOrderLine(
        po_id=po.id,
        line_number=1,
        product_id=body.product_id,
        qty_ordered=body.quantity,
    )
    db.add(line)
    db.commit()
    db.refresh(po)

    return {
        "ok": True,
        "po_number": po.po_number,
        "po_id": po.id,
        "supplier_code": best.supplier.code if best.supplier else None,
        "lead_time_days": best.lead_time_days,
        "message": f"Draft PO {po.po_number} created for {body.quantity}× {product.code} from {best.supplier.name if best.supplier else 'supplier'} → {location.code}",
    }


# ---------------------------------------------------------------------------
# Purchase Prediction — forecast POs from demand signals + supplier lead times
# ---------------------------------------------------------------------------

@router.get("/purchase-prediction")
def get_purchase_prediction(
    months_ahead: int = 6,
    location_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    For each future demand signal where demand > total stock, returns a purchase
    recommendation enriched with best supplier, lead time, and order-by date.
    urgency: Urgent (order date <= today), Soon (within 30 days), Planned (>30 days)
    """
    from datetime import date as _date, timedelta
    today = _date.today()

    month_starts = []
    for i in range(1, months_ahead + 1):
        m = today.month + i
        y = today.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        month_starts.append(f"{y}-{m:02d}-01")

    q = db.query(DemandSignal).filter(DemandSignal.period_date.in_(month_starts))
    if location_id:
        q = q.filter(DemandSignal.location_id == location_id)
    if product_id:
        q = q.filter(DemandSignal.product_id == product_id)
    signals = q.order_by(DemandSignal.period_date, DemandSignal.product_id).all()

    rows = []
    for s in signals:
        if not s.product or not s.location:
            continue
        total = _total_stock_for(s.product, s.location_id, db)
        available = _available_stock_for(s.product, s.location_id, db)
        shortage = s.quantity - total
        if shortage <= 0:
            continue

        # Find best supplier for this product (shortest lead time, nulls last)
        ps_rows = db.query(ProductSupplier).filter(
            ProductSupplier.product_id == s.product_id
        ).all()
        ps_rows.sort(key=lambda r: (r.lead_time_days is None, r.lead_time_days or 0))
        best = ps_rows[0] if ps_rows else None

        lead_time_days = best.lead_time_days if best and best.lead_time_days else None
        supplier_id = best.supplier_id if best else None
        supplier_name = best.supplier.name if best and best.supplier else None
        supplier_code = best.supplier.code if best and best.supplier else None

        # Calculate order-by date: demand month start minus lead time
        period_dt = _date.fromisoformat(s.period_date)
        if lead_time_days:
            order_by_date = period_dt - timedelta(days=lead_time_days)
        else:
            order_by_date = period_dt  # no lead time → order by demand month

        days_until_order = (order_by_date - today).days

        if days_until_order <= 0:
            urgency = "Urgent"
        elif days_until_order <= 30:
            urgency = "Soon"
        else:
            urgency = "Planned"

        rows.append({
            "signal_id": s.id,
            "product_id": s.product_id,
            "product_code": s.product.code,
            "product_name": s.product.name,
            "location_id": s.location_id,
            "location_code": s.location.code,
            "location_name": s.location.name,
            "period_date": s.period_date,
            "demand_qty": s.quantity,
            "stock_qty": total,
            "available_qty": available,
            "shortage_qty": shortage,
            "supplier_id": supplier_id,
            "supplier_code": supplier_code,
            "supplier_name": supplier_name,
            "lead_time_days": lead_time_days,
            "order_by_date": order_by_date.isoformat(),
            "days_until_order": days_until_order,
            "urgency": urgency,
        })

    # Sort: Urgent first, then by days_until_order ascending
    rows.sort(key=lambda r: ({"Urgent": 0, "Soon": 1, "Planned": 2}[r["urgency"]], r["days_until_order"]))
    return rows
