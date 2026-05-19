"""
cost_engine.py — Cost calculation helper (Phase 2D).

Call apply_cost() after creating a StateHistory record and before db.commit().
It will populate cost fields on the history record and update accumulated_cost
on the serial number.
"""

from datetime import datetime, timezone

from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from models import ActivityCostMaster, ExchangeRateMaster, Location, SerialNumber, StateHistory


def apply_cost(
    db: Session,
    serial: SerialNumber,
    history: StateHistory,
    state_code: str,
    location_id: int,
) -> None:
    """
    Look up Activity Cost Master for location+state+(optional product) and apply
    the cost to the history record and serial.accumulated_cost.

    Lookup priority:
      1. location_code + state_code + product_code  (product-specific)
      2. location_code + state_code + NULL           (generic fallback)
      3. No match → record stays with zero cost fields
    """
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        return

    location_code = location.code
    reporting_currency = location.reporting_currency or "EUR"
    product_code = serial.product.code if serial.product else None

    loc_lower = location_code.lower()
    state_lower = state_code.lower()

    # 1. Product-specific lookup
    cost_row = None
    if product_code:
        cost_row = (
            db.query(ActivityCostMaster)
            .filter(
                sqlfunc.lower(ActivityCostMaster.location_code) == loc_lower,
                sqlfunc.lower(ActivityCostMaster.state_code) == state_lower,
                sqlfunc.lower(ActivityCostMaster.product_code) == product_code.lower(),
                ActivityCostMaster.active == 1,
            )
            .first()
        )

    # 2. Generic fallback
    if not cost_row:
        cost_row = (
            db.query(ActivityCostMaster)
            .filter(
                sqlfunc.lower(ActivityCostMaster.location_code) == loc_lower,
                sqlfunc.lower(ActivityCostMaster.state_code) == state_lower,
                ActivityCostMaster.product_code == None,  # noqa: E711
                ActivityCostMaster.active == 1,
            )
            .first()
        )

    if not cost_row:
        return  # No cost configured for this location+state — zero cost

    activity_amount = cost_row.amount
    native_currency = cost_row.currency

    # FX conversion
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    rate = 1.0
    reporting_equiv = activity_amount

    if native_currency != reporting_currency:
        fx_row = (
            db.query(ExchangeRateMaster)
            .filter(
                ExchangeRateMaster.from_currency == native_currency,
                ExchangeRateMaster.to_currency == reporting_currency,
                ExchangeRateMaster.effective_date <= today,
            )
            .order_by(ExchangeRateMaster.effective_date.desc())
            .first()
        )
        if fx_row:
            rate = fx_row.rate
            reporting_equiv = round(activity_amount * rate, 4)
        # else: no FX rate found, use native amount as-is (best effort)

    # Populate history record
    history.activity_cost = activity_amount
    history.activity_cost_currency = native_currency
    history.reporting_currency_equiv = reporting_equiv
    history.exchange_rate_applied = rate

    # Accumulate on serial
    serial.accumulated_cost = round((serial.accumulated_cost or 0) + reporting_equiv, 4)
