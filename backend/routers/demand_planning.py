"""
demand_planning.py — Demand Planning router (Phase 2H).
Prefix: /api/demand
"""
from datetime import datetime
from typing import Optional

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import NonSerialisedInventory, DemandSignal, Location, Product, SerialNumber

router = APIRouter(prefix="/api/demand", tags=["demand"])

PLANNER_ROLES = {"admin", "supply_planner", "demand_planner"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SignalCreate(BaseModel):
    product_id: int
    location_id: Optional[int] = None
    period_date: str          # YYYY-MM-DD (first of month)
    quantity: int
    notes: Optional[str] = None


class SignalUpdate(BaseModel):
    product_id: Optional[int] = None
    location_id: Optional[int] = None
    period_date: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _out(s: DemandSignal) -> dict:
    return {
        "id": s.id,
        "product_id": s.product_id,
        "product_code": s.product.code if s.product else None,
        "product_name": s.product.name if s.product else None,
        "location_id": s.location_id,
        "location_code": s.location.code if s.location else None,
        "location_name": s.location.name if s.location else None,
        "period_date": s.period_date,
        "quantity": s.quantity,
        "notes": s.notes,
        "created_by_username": s.created_by.username if s.created_by else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Demand Signals CRUD
# ---------------------------------------------------------------------------

@router.get("/signals")
def list_signals(
    product_id: Optional[int] = None,
    location_id: Optional[int] = None,
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(DemandSignal)
    if product_id:
        q = q.filter(DemandSignal.product_id == product_id)
    if location_id:
        q = q.filter(DemandSignal.location_id == location_id)
    if period_from:
        q = q.filter(DemandSignal.period_date >= period_from)
    if period_to:
        q = q.filter(DemandSignal.period_date <= period_to)
    signals = q.order_by(DemandSignal.period_date.desc(), DemandSignal.product_id).all()
    return [_out(s) for s in signals]


@router.post("/signals")
def create_signal(
    body: SignalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    signal = DemandSignal(
        product_id=body.product_id,
        location_id=body.location_id,
        period_date=body.period_date,
        quantity=body.quantity,
        notes=body.notes,
        created_by_user_id=current_user.id,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return _out(signal)


@router.put("/signals/{signal_id}")
def update_signal(
    signal_id: int,
    body: SignalUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    signal = db.query(DemandSignal).filter(DemandSignal.id == signal_id).first()
    if not signal:
        raise HTTPException(404, "Signal not found")
    if body.product_id is not None:
        signal.product_id = body.product_id
    if body.location_id is not None:
        signal.location_id = body.location_id
    if body.period_date is not None:
        signal.period_date = body.period_date
    if body.quantity is not None:
        signal.quantity = body.quantity
    if body.notes is not None:
        signal.notes = body.notes
    signal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(signal)
    return _out(signal)


@router.delete("/signals/{signal_id}")
def delete_signal(
    signal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"admin", "demand_planner"}:
        raise HTTPException(403, "Insufficient permissions")
    signal = db.query(DemandSignal).filter(DemandSignal.id == signal_id).first()
    if not signal:
        raise HTTPException(404, "Signal not found")
    db.delete(signal)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Forecast view — demand vs actual stock
# ---------------------------------------------------------------------------

@router.get("/forecast")
def get_forecast(
    period_date: Optional[str] = None,
    product_id: Optional[int] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns demand signals enriched with current stock levels.
    gap = stock_qty - demand_qty  (positive = surplus, negative = shortfall)
    """
    q = db.query(DemandSignal)
    if period_date:
        q = q.filter(DemandSignal.period_date == period_date)
    if product_id:
        q = q.filter(DemandSignal.product_id == product_id)
    if location_id:
        q = q.filter(DemandSignal.location_id == location_id)
    signals = q.order_by(DemandSignal.period_date, DemandSignal.product_id).all()

    rows = []
    for s in signals:
        product = s.product
        location = s.location

        if product and product.serialised:
            sq = db.query(func.count(SerialNumber.id)).filter(
                SerialNumber.product_id == s.product_id,
                SerialNumber.active == 1,
            )
            if s.location_id:
                sq = sq.filter(SerialNumber.current_location_id == s.location_id)
            stock_qty = sq.scalar() or 0
        else:
            aq = db.query(func.sum(NonSerialisedInventory.quantity)).filter(
                NonSerialisedInventory.product_id == s.product_id,
            )
            if s.location_id:
                aq = aq.filter(NonSerialisedInventory.location_id == s.location_id)
            stock_qty = aq.scalar() or 0

        rows.append({
            "signal_id": s.id,
            "product_id": s.product_id,
            "product_code": product.code if product else None,
            "product_name": product.name if product else None,
            "location_id": s.location_id,
            "location_code": location.code if location else "All Locations",
            "location_name": location.name if location else "All Locations",
            "period_date": s.period_date,
            "demand_qty": s.quantity,
            "stock_qty": stock_qty,
            "gap": stock_qty - s.quantity,
        })

    return rows


@router.post("/signals/upload-csv")
async def upload_signals_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """CSV format: product_code,location_code,period_date,quantity,notes"""
    if current_user.role not in PLANNER_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            product_code = (row.get("product_code") or "").strip()
            location_code = (row.get("location_code") or "").strip()
            period_raw = (row.get("period_date") or "").strip()
            qty_raw = (row.get("quantity") or "").strip()
            notes = (row.get("notes") or "").strip() or None
            if not product_code or not period_raw or not qty_raw:
                errors.append(f"Row {i}: missing product_code, period_date, or quantity"); continue
            period_date = (period_raw + "-01") if len(period_raw) == 7 else (period_raw[:8] + "01") if len(period_raw) == 10 else None
            if not period_date:
                errors.append(f"Row {i}: invalid period_date '{period_raw}'"); continue
            product = db.query(Product).filter(Product.code == product_code).first()
            if not product:
                errors.append(f"Row {i}: product '{product_code}' not found"); continue
            location_id = None
            if location_code:
                loc = db.query(Location).filter(Location.code == location_code).first()
                if not loc:
                    errors.append(f"Row {i}: location '{location_code}' not found"); continue
                location_id = loc.id
            qty = int(qty_raw)
            existing = db.query(DemandSignal).filter(
                DemandSignal.product_id == product.id,
                DemandSignal.location_id == location_id,
                DemandSignal.period_date == period_date,
            ).first()
            if existing:
                existing.quantity = qty; existing.notes = notes; existing.updated_at = datetime.utcnow()
            else:
                db.add(DemandSignal(product_id=product.id, location_id=location_id, period_date=period_date, quantity=qty, notes=notes, created_by_user_id=current_user.id))
            created += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    db.commit()
    return {"ok": True, "created_or_updated": created, "errors": errors}
