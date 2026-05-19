"""
routers/alerts.py — Phase 2K Alerting Framework

Alert types:
  RETURN_RECEIVED  — New return requiring warehouse action
  REPAIR_OVERDUE   — Terminal in repair > product.repair_max_days
  TRANSIT_DELAY    — In-transit terminal past expected lead time (+1d Urgent, +2d+ Critical)
  LOW_STOCK        — Location stock below safety stock reorder_point
  BATTERY_AGING    — Days since last recharge vs product.battery_life_days
  WARRANTY_EXPIRY  — Days since first SO/RN/RP receipt vs product.warranty_days
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Alert, AlertRule,
    ReturnOrder, RepairOrder,
    SerialNumber, StateHistory, TerminalState,
    SafetyStockTarget, Product, Location,
    TransitTimeLane, TransitTimeFallback,
    PurchaseOrder,
)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _days_since(iso_str: Optional[str]) -> Optional[int]:
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00")).replace(tzinfo=None)
        return (datetime.utcnow() - dt).days
    except Exception:
        return None


def _clear_rule_alerts(db: Session, rule_id: int):
    """Remove all New/Acknowledged alerts for a rule before re-evaluating."""
    db.query(Alert).filter(Alert.rule_id == rule_id).delete()


# ---------------------------------------------------------------------------
# Evaluators
# ---------------------------------------------------------------------------

def _eval_return_received(db: Session, rule: AlertRule) -> int:
    """One alert per return order that is Open/Received (action pending)."""
    _clear_rule_alerts(db, rule.id)
    count = 0
    returns = db.query(ReturnOrder).filter(ReturnOrder.status.in_(["Open", "Received"])).all()
    for r in returns:
        msg = f"Return order {r.order_number} requires warehouse processing."
        alert = Alert(
            rule_id=rule.id,
            severity="Urgent",
            status="New",
            reference_id=r.id,
            reference_type="return_order",
            message=msg,
        )
        db.add(alert)
        count += 1
    return count


def _eval_repair_overdue(db: Session, rule: AlertRule) -> int:
    """Flag terminals in repair > product.repair_max_days."""
    _clear_rule_alerts(db, rule.id)
    count = 0

    repair_state = db.query(TerminalState).filter(TerminalState.code == "IN_REPAIR").first()
    if not repair_state:
        return 0

    serials_in_repair = (
        db.query(SerialNumber)
        .filter(SerialNumber.current_state_id == repair_state.id)
        .all()
    )
    for s in serials_in_repair:
        product = db.query(Product).filter(Product.id == s.product_id).first()
        if not product or not product.repair_max_days:
            continue

        # Find the most recent entry into IN_REPAIR
        entry = (
            db.query(StateHistory)
            .filter(StateHistory.serial_number_id == s.id, StateHistory.state_id == repair_state.id)
            .order_by(StateHistory.datetime_utc.desc())
            .first()
        )
        if not entry:
            continue
        days = _days_since(str(entry.datetime_utc))
        if days is None or days <= product.repair_max_days:
            continue

        overdue = days - product.repair_max_days
        severity = "Critical" if overdue >= 7 else "Urgent"
        msg = (
            f"Terminal {s.serial_number} in repair for {days} days "
            f"(max {product.repair_max_days}d — {overdue}d overdue)."
        )
        db.add(Alert(
            rule_id=rule.id,
            severity=severity,
            status="New",
            serial_id=s.id,
            product_id=s.product_id,
            message=msg,
            days_overdue=overdue,
        ))
        count += 1
    return count


def _eval_transit_delay(db: Session, rule: AlertRule) -> int:
    """Flag in-transit terminals past expected lead time."""
    _clear_rule_alerts(db, rule.id)
    count = 0

    urgent_add = rule.threshold_urgent_days or 1
    critical_add = rule.threshold_critical_days or 2

    TRANSIT_CODES = ["TRANSIT_TO_COMPANY", "TRANSIT_TO_WAREHOUSE", "TRANSIT_TO_REPAIR", "EXPECTING"]
    transit_states = db.query(TerminalState).filter(TerminalState.code.in_(TRANSIT_CODES)).all()
    state_ids = {s.id for s in transit_states}
    if not state_ids:
        return 0

    fallback_row = db.query(TransitTimeFallback).first()
    fallback_days = fallback_row.lead_time_days if fallback_row else 14

    serials = db.query(SerialNumber).filter(SerialNumber.current_state_id.in_(state_ids)).all()
    for s in serials:
        # Time of entering current transit state
        current_state = db.query(TerminalState).filter(TerminalState.id == s.current_state_id).first()
        entry = (
            db.query(StateHistory)
            .filter(StateHistory.serial_number_id == s.id, StateHistory.state_id == s.current_state_id)
            .order_by(StateHistory.datetime_utc.desc())
            .first()
        )
        if not entry:
            continue

        days_in_transit = _days_since(str(entry.datetime_utc))
        if days_in_transit is None:
            continue

        # Try to find specific lane lead time
        lane_days = None
        if s.current_location_id:
            lane = (
                db.query(TransitTimeLane)
                .filter(TransitTimeLane.from_location_id == s.current_location_id)
                .order_by(TransitTimeLane.lead_time_days)
                .first()
            )
            if lane:
                lane_days = lane.lead_time_days

        expected = lane_days or fallback_days
        overdue = days_in_transit - expected
        if overdue < urgent_add:
            continue

        severity = "Critical" if overdue >= critical_add else "Urgent"
        state_label = current_state.display_name if current_state else "Transit"
        msg = (
            f"Terminal {s.serial_number} in {state_label} for {days_in_transit} days "
            f"(expected {expected}d — {overdue}d overdue)."
        )
        db.add(Alert(
            rule_id=rule.id,
            severity=severity,
            status="New",
            serial_id=s.id,
            product_id=s.product_id,
            location_id=s.current_location_id,
            message=msg,
            days_overdue=overdue,
        ))
        count += 1
    return count


def _eval_low_stock(db: Session, rule: AlertRule) -> int:
    """Flag product/location combos below reorder_point."""
    _clear_rule_alerts(db, rule.id)
    count = 0

    targets = db.query(SafetyStockTarget).all()

    # Build stock counts per product/location
    # Count serials in "available" states at each location
    available_codes = ["AVAILABLE", "QUARANTINE", "QUARANTINE_REFURBISHED"]
    avail_states = db.query(TerminalState).filter(TerminalState.code.in_(available_codes)).all()
    avail_ids = {s.id for s in avail_states}

    for target in targets:
        qty = (
            db.query(sqlfunc.count(SerialNumber.id))
            .filter(
                SerialNumber.product_id == target.product_id,
                SerialNumber.current_location_id == target.location_id,
                SerialNumber.current_state_id.in_(avail_ids),
            )
            .scalar()
        ) or 0

        if qty >= target.reorder_point:
            continue

        product = db.query(Product).filter(Product.id == target.product_id).first()
        location = db.query(Location).filter(Location.id == target.location_id).first()
        if not product or not location:
            continue

        severity = "Critical" if qty <= target.min_qty else "Urgent"
        msg = (
            f"Low stock: {product.code} at {location.code} — "
            f"{qty} units (reorder point: {target.reorder_point})."
        )
        db.add(Alert(
            rule_id=rule.id,
            severity=severity,
            status="New",
            product_id=target.product_id,
            location_id=target.location_id,
            message=msg,
        ))
        count += 1
    return count


def _eval_battery_aging(db: Session, rule: AlertRule) -> int:
    """Flag terminals with depleted batteries (based on product.battery_life_days)."""
    _clear_rule_alerts(db, rule.id)
    count = 0

    recharged_state = db.query(TerminalState).filter(TerminalState.code == "RECHARGED").first()
    quarantine_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE").first()
    qr_state = db.query(TerminalState).filter(TerminalState.code == "QUARANTINE_REFURBISHED").first()

    reset_ids = {s.id for s in [recharged_state, quarantine_state, qr_state] if s}

    # Only products with battery_life_days set
    products_with_battery = db.query(Product).filter(Product.battery_life_days.isnot(None)).all()
    product_map = {p.id: p for p in products_with_battery}
    if not product_map:
        return 0

    # Get all active serials for those products
    serials = (
        db.query(SerialNumber)
        .filter(SerialNumber.product_id.in_(product_map.keys()))
        .all()
    )

    for s in serials:
        product = product_map[s.product_id]
        if not product.battery_life_days:
            continue

        # Find most recent battery reset event
        reset_entry = (
            db.query(StateHistory)
            .filter(StateHistory.serial_number_id == s.id, StateHistory.state_id.in_(reset_ids))
            .order_by(StateHistory.datetime_utc.desc())
            .first()
        )
        if not reset_entry:
            continue

        days_since_reset = _days_since(str(reset_entry.datetime_utc))
        if days_since_reset is None:
            continue

        days_remaining = product.battery_life_days - days_since_reset

        if days_remaining > 7:
            continue  # Still healthy

        if days_remaining > 0:
            severity = "Normal"
        elif days_remaining > -3:
            severity = "Urgent"
        else:
            severity = "Critical"

        overdue = -days_remaining if days_remaining < 0 else 0
        msg = (
            f"Battery aging: {s.serial_number} — "
            f"{days_since_reset} days since last recharge "
            f"({'expired' if days_remaining <= 0 else f'{days_remaining}d remaining'})."
        )
        db.add(Alert(
            rule_id=rule.id,
            severity=severity,
            status="New",
            serial_id=s.id,
            product_id=s.product_id,
            location_id=s.current_location_id,
            message=msg,
            days_overdue=overdue if overdue > 0 else None,
        ))
        count += 1
    return count


def _eval_warranty_expiry(db: Session, rule: AlertRule) -> int:
    """Flag terminals approaching/past warranty expiry."""
    _clear_rule_alerts(db, rule.id)
    count = 0

    urgent_threshold = rule.threshold_urgent_days or 30   # warn 30d before expiry
    critical_threshold = rule.threshold_critical_days or 0  # 0 = at/after expiry

    # Only products with warranty_days set
    products_with_warranty = db.query(Product).filter(Product.warranty_days.isnot(None)).all()
    product_map = {p.id: p for p in products_with_warranty}
    if not product_map:
        return 0

    # Find RECEIVED state
    received_state = db.query(TerminalState).filter(TerminalState.code == "RECEIVED").first()
    if not received_state:
        return 0

    import re
    sale_pattern = re.compile(r'^(SO|RN|RP)', re.IGNORECASE)

    serials = (
        db.query(SerialNumber)
        .filter(SerialNumber.product_id.in_(product_map.keys()))
        .all()
    )

    for s in serials:
        product = product_map[s.product_id]
        if not product.warranty_days:
            continue

        # Find first RECEIVED on a SO/RN/RP order
        sale_entries = (
            db.query(StateHistory)
            .filter(
                StateHistory.serial_number_id == s.id,
                StateHistory.state_id == received_state.id,
            )
            .order_by(StateHistory.datetime_utc.asc())
            .all()
        )
        first_sale = next(
            (e for e in sale_entries if e.order_reference and sale_pattern.match(e.order_reference)),
            None
        )
        if not first_sale:
            continue

        days_since_sale = _days_since(str(first_sale.datetime_utc))
        if days_since_sale is None:
            continue

        days_remaining = product.warranty_days - days_since_sale

        if days_remaining > urgent_threshold:
            continue  # Plenty of warranty left

        if days_remaining <= critical_threshold:
            severity = "Critical"
        else:
            severity = "Urgent"

        overdue = -days_remaining if days_remaining < 0 else 0
        msg = (
            f"Warranty {'expired' if days_remaining <= 0 else 'expiring soon'}: "
            f"{s.serial_number} — "
            f"{'expired ' + str(abs(days_remaining)) + 'd ago' if days_remaining <= 0 else str(days_remaining) + 'd remaining'}."
        )
        db.add(Alert(
            rule_id=rule.id,
            severity=severity,
            status="New",
            serial_id=s.id,
            product_id=s.product_id,
            location_id=s.current_location_id,
            message=msg,
            days_overdue=overdue if overdue > 0 else None,
        ))
        count += 1
    return count


EVALUATORS = {
    "RETURN_RECEIVED": _eval_return_received,
    "REPAIR_OVERDUE":  _eval_repair_overdue,
    "TRANSIT_DELAY":   _eval_transit_delay,
    "LOW_STOCK":       _eval_low_stock,
    "BATTERY_AGING":   _eval_battery_aging,
    "WARRANTY_EXPIRY": _eval_warranty_expiry,
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AlertRuleUpdate(BaseModel):
    enabled: Optional[int] = None
    threshold_urgent_days: Optional[int] = None
    threshold_critical_days: Optional[int] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run")
def run_alerts(db: Session = Depends(get_db)):
    """Re-evaluate all enabled alert rules and return summary."""
    rules = db.query(AlertRule).filter(AlertRule.enabled == 1).all()
    summary = {}
    for rule in rules:
        evaluator = EVALUATORS.get(rule.rule_code)
        if evaluator:
            n = evaluator(db, rule)
            summary[rule.rule_code] = n
    db.commit()
    total = sum(summary.values())
    return {"alerts_generated": total, "by_rule": summary}


@router.get("/summary")
def alert_summary(db: Session = Depends(get_db)):
    """Counts of New alerts by severity — used by the bell icon."""
    rows = (
        db.query(Alert.severity, sqlfunc.count(Alert.id))
        .filter(Alert.status == "New")
        .group_by(Alert.severity)
        .all()
    )
    counts = {r[0]: r[1] for r in rows}
    total = sum(counts.values())
    return {
        "total": total,
        "critical": counts.get("Critical", 0),
        "urgent": counts.get("Urgent", 0),
        "normal": counts.get("Normal", 0),
    }


@router.get("")
def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    rule_code: Optional[str] = Query(None),
    limit: int = Query(200),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)
    if rule_code:
        rule = db.query(AlertRule).filter(AlertRule.rule_code == rule_code).first()
        if rule:
            q = q.filter(Alert.rule_id == rule.id)
    alerts = q.order_by(Alert.created_at.desc()).limit(limit).all()

    def _out(a: Alert):
        serial_number = a.serial.serial_number if a.serial else None
        product_code = a.product.code if a.product else None
        location_code = a.location.code if a.location else None
        return {
            "id": a.id,
            "rule_code": a.rule.rule_code if a.rule else None,
            "rule_name": a.rule.name if a.rule else None,
            "severity": a.severity,
            "status": a.status,
            "message": a.message,
            "serial_number": serial_number,
            "serial_id": a.serial_id,
            "product_code": product_code,
            "product_id": a.product_id,
            "location_code": location_code,
            "location_id": a.location_id,
            "reference_id": a.reference_id,
            "reference_type": a.reference_type,
            "days_overdue": a.days_overdue,
            "created_at": str(a.created_at) if a.created_at else None,
            "acknowledged_at": str(a.acknowledged_at) if a.acknowledged_at else None,
        }

    return [_out(a) for a in alerts]


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = "Acknowledged"
    alert.acknowledged_at = _now()
    db.commit()
    return {"ok": True}


@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(AlertRule).order_by(AlertRule.id).all()
    return [
        {
            "id": r.id,
            "rule_code": r.rule_code,
            "name": r.name,
            "description": r.description,
            "enabled": bool(r.enabled),
            "threshold_urgent_days": r.threshold_urgent_days,
            "threshold_critical_days": r.threshold_critical_days,
        }
        for r in rules
    ]


@router.put("/rules/{rule_id}")
def update_rule(rule_id: int, payload: AlertRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    if payload.enabled is not None:
        rule.enabled = payload.enabled
    if payload.threshold_urgent_days is not None:
        rule.threshold_urgent_days = payload.threshold_urgent_days
    if payload.threshold_critical_days is not None:
        rule.threshold_critical_days = payload.threshold_critical_days
    rule.updated_at = _now()
    db.commit()
    return {"ok": True}
