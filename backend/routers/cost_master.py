"""
cost_master.py — Activity Cost Master + Exchange Rate Master CRUD (Phase 2D).

All write endpoints require admin role.
Prefix: /api/cost
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ActivityCostMaster, ExchangeRateMaster, User

router = APIRouter(prefix="/api/cost", tags=["cost"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ActivityCostIn(BaseModel):
    location_code: str
    state_code: str
    product_code: Optional[str] = None
    amount: float
    currency: str = "EUR"


class ExchangeRateIn(BaseModel):
    from_currency: str
    to_currency: str
    rate: float
    effective_date: str  # YYYY-MM-DD


# ---------------------------------------------------------------------------
# Activity Cost Master endpoints
# ---------------------------------------------------------------------------

@router.get("/activity-costs")
def list_activity_costs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(ActivityCostMaster)
        .filter(ActivityCostMaster.active == 1)
        .order_by(ActivityCostMaster.location_code, ActivityCostMaster.state_code)
        .all()
    )
    return [
        {
            "id": r.id,
            "location_code": r.location_code,
            "state_code": r.state_code,
            "product_code": r.product_code,
            "amount": r.amount,
            "currency": r.currency,
            "active": r.active,
        }
        for r in rows
    ]


@router.post("/activity-costs", status_code=status.HTTP_201_CREATED)
def create_activity_cost(
    payload: ActivityCostIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = ActivityCostMaster(
        location_code=payload.location_code.strip(),
        state_code=payload.state_code.strip(),
        product_code=payload.product_code.strip() if payload.product_code else None,
        amount=payload.amount,
        currency=payload.currency.strip().upper(),
        active=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "location_code": row.location_code, "state_code": row.state_code,
            "product_code": row.product_code, "amount": row.amount, "currency": row.currency, "active": row.active}


@router.put("/activity-costs/{row_id}")
def update_activity_cost(
    row_id: int,
    payload: ActivityCostIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = db.query(ActivityCostMaster).filter(ActivityCostMaster.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.location_code = payload.location_code.strip()
    row.state_code = payload.state_code.strip()
    row.product_code = payload.product_code.strip() if payload.product_code else None
    row.amount = payload.amount
    row.currency = payload.currency.strip().upper()
    db.commit()
    db.refresh(row)
    return {"id": row.id, "location_code": row.location_code, "state_code": row.state_code,
            "product_code": row.product_code, "amount": row.amount, "currency": row.currency, "active": row.active}


@router.delete("/activity-costs/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_cost(
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = db.query(ActivityCostMaster).filter(ActivityCostMaster.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.active = 0
    db.commit()


# ---------------------------------------------------------------------------
# Exchange Rate Master endpoints
# ---------------------------------------------------------------------------

@router.get("/exchange-rates")
def list_exchange_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(ExchangeRateMaster)
        .order_by(ExchangeRateMaster.from_currency, ExchangeRateMaster.to_currency,
                  ExchangeRateMaster.effective_date.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "from_currency": r.from_currency,
            "to_currency": r.to_currency,
            "rate": r.rate,
            "effective_date": r.effective_date,
        }
        for r in rows
    ]


@router.post("/exchange-rates", status_code=status.HTTP_201_CREATED)
def create_exchange_rate(
    payload: ExchangeRateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = ExchangeRateMaster(
        from_currency=payload.from_currency.strip().upper(),
        to_currency=payload.to_currency.strip().upper(),
        rate=payload.rate,
        effective_date=payload.effective_date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "from_currency": row.from_currency, "to_currency": row.to_currency,
            "rate": row.rate, "effective_date": row.effective_date}


@router.put("/exchange-rates/{row_id}")
def update_exchange_rate(
    row_id: int,
    payload: ExchangeRateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = db.query(ExchangeRateMaster).filter(ExchangeRateMaster.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.from_currency = payload.from_currency.strip().upper()
    row.to_currency = payload.to_currency.strip().upper()
    row.rate = payload.rate
    row.effective_date = payload.effective_date
    db.commit()
    db.refresh(row)
    return {"id": row.id, "from_currency": row.from_currency, "to_currency": row.to_currency,
            "rate": row.rate, "effective_date": row.effective_date}


@router.delete("/exchange-rates/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exchange_rate(
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = db.query(ExchangeRateMaster).filter(ExchangeRateMaster.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
