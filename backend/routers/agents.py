from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from auth import get_current_user
from database import get_db
from models import User, AgentLog, AgentRecommendation, AgentRun, AgentAllocationIntent

router = APIRouter(prefix="/api/agents", tags=["agents"])


def require_admin_or_planner(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, "roles_list", [current_user.role])
    if not any(r in roles for r in ("admin", "supply_planner")):
        raise HTTPException(status_code=403, detail="Admin or Supply Planner access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ---------------------------------------------------------------------------
# POST /api/agents/shortage/run-now
# ---------------------------------------------------------------------------
@router.post("/shortage/run-now")
def run_shortage_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from agents.ims_inventory_shortage import run_shortage_agent
    result = run_shortage_agent(triggered_by=f"manual:{current_user.username}")
    return result


# ---------------------------------------------------------------------------
# GET /api/agents/runs  — run history
# ---------------------------------------------------------------------------
@router.get("/runs")
def list_runs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    rows = (db.query(AgentRun)
            .filter(AgentRun.agent_name == "IMS_InventoryShortage")
            .order_by(AgentRun.id.desc())
            .limit(limit).all())
    return [_run_out(r) for r in rows]


def _run_out(r: AgentRun) -> dict:
    started  = r.started_at
    completed = r.completed_at
    duration_s = None
    if started and completed:
        try:
            duration_s = int((completed - started).total_seconds())
        except Exception:
            pass
    return {
        "id":               r.id,
        "run_id":           r.run_id,
        "agent_name":       r.agent_name,
        "triggered_by":     r.triggered_by,
        "status":           r.status,
        "shortages_found":  r.shortages_found,
        "actions_taken":    r.actions_taken,
        "hitl_items":       r.hitl_items,
        "intents_recorded": r.intents_recorded,
        "intents_executed": r.intents_executed,
        "summary_text":     r.summary_text,
        "started_at":       str(started) if started else None,
        "completed_at":     str(completed) if completed else None,
        "duration_s":       duration_s,
    }


# ---------------------------------------------------------------------------
# GET /api/agents/runs/{run_id}/logs  — thinking log for one run
# ---------------------------------------------------------------------------
@router.get("/runs/{run_id}/logs")
def get_run_logs(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    rows = (db.query(AgentLog)
            .filter(AgentLog.run_id == run_id)
            .order_by(AgentLog.id.asc()).all())
    return [
        {
            "id":         r.id,
            "run_id":     r.run_id,
            "step_type":  r.step_type,
            "message":    r.message,
            "order_ref":  r.order_ref,
            "created_at": str(r.created_at) if r.created_at else None,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/agents/shortage/logs  — legacy (kept for backward compat)
# ---------------------------------------------------------------------------
@router.get("/shortage/logs")
def get_shortage_logs(
    run_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    q = db.query(AgentLog).filter(AgentLog.agent_name == "IMS_InventoryShortage")
    if run_id:
        q = q.filter(AgentLog.run_id == run_id)
    rows = q.order_by(AgentLog.id.desc()).limit(limit).all()
    return [
        {"id": r.id, "run_id": r.run_id, "step_type": r.step_type,
         "message": r.message, "order_ref": r.order_ref,
         "created_at": str(r.created_at) if r.created_at else None}
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/agents/intents
# ---------------------------------------------------------------------------
@router.get("/intents")
def list_intents(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    q = (db.query(AgentAllocationIntent)
         .filter(AgentAllocationIntent.agent_name == "IMS_InventoryShortage")
         .order_by(AgentAllocationIntent.id.desc()))
    if status:
        q = q.filter(AgentAllocationIntent.status == status)
    rows = q.limit(200).all()
    return [_intent_out(r, None) for r in rows]


def _intent_out(r: AgentAllocationIntent, db) -> dict:
    return {
        "id":               r.id,
        "run_id":           r.run_id,
        "product_id":       r.product_id,
        "product_code":     r.product.code if r.product else None,
        "product_name":     r.product.name if r.product else None,
        "from_location_id": r.from_location_id,
        "from_location_code": r.from_location.code if r.from_location else None,
        "to_location_id":   r.to_location_id,
        "to_location_code": r.to_location.code if r.to_location else None,
        "reserved_qty":     r.reserved_qty,
        "remaining_qty":    r.remaining_qty,
        "reasoning":        r.reasoning,
        "status":           r.status,
        "horizon_days":     r.horizon_days,
        "created_at":       str(r.created_at) if r.created_at else None,
        "executed_at":      str(r.executed_at) if r.executed_at else None,
        "execution_do_refs": r.execution_do_refs,
    }


# ---------------------------------------------------------------------------
# PUT /api/agents/intents/{id}/cancel
# ---------------------------------------------------------------------------
@router.put("/intents/{intent_id}/cancel")
def cancel_intent(
    intent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    intent = db.query(AgentAllocationIntent).filter(AgentAllocationIntent.id == intent_id).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")
    if intent.status not in ("Pending", "PartiallyExecuted"):
        raise HTTPException(status_code=422, detail=f"Cannot cancel intent with status '{intent.status}'")
    intent.status = "Cancelled"
    intent.cancelled_at = datetime.utcnow()
    intent.cancelled_by_user_id = current_user.id
    db.commit()
    db.refresh(intent)
    return _intent_out(intent, db)


# ---------------------------------------------------------------------------
# GET /api/agents/recommendations
# ---------------------------------------------------------------------------
@router.get("/recommendations")
def list_recommendations(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    q = db.query(AgentRecommendation).order_by(AgentRecommendation.id.desc())
    if status:
        q = q.filter(AgentRecommendation.status == status)
    rows = q.limit(500).all()
    return [_rec_out(r) for r in rows]


def _rec_out(r: AgentRecommendation) -> dict:
    return {
        "id":               r.id,
        "run_id":           r.run_id,
        "agent_name":       r.agent_name,
        "rec_type":         r.rec_type,
        "product_id":       r.product_id,
        "product_code":     r.product.code if r.product else None,
        "product_name":     r.product.name if r.product else None,
        "from_location_id": r.from_location_id,
        "from_location_code": r.from_location.code if r.from_location else None,
        "to_location_id":   r.to_location_id,
        "to_location_code": r.to_location.code if r.to_location else None,
        "qty":              r.qty,
        "shortage_qty":     r.shortage_qty,
        "estimated_value":  r.estimated_value,
        "status":           r.status,
        "order_ref":        r.order_ref,
        "notes":            r.notes,
        "created_at":       str(r.created_at) if r.created_at else None,
        "actioned_at":      str(r.actioned_at) if r.actioned_at else None,
        "actioned_by":      r.actioned_by.username if r.actioned_by else None,
    }


# ---------------------------------------------------------------------------
# PUT /api/agents/recommendations/{id}/action
# ---------------------------------------------------------------------------
class ActionPayload(BaseModel):
    action: str   # "Actioned" or "Dismissed"


@router.put("/recommendations/{rec_id}/action")
def action_recommendation(
    rec_id: int,
    payload: ActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_planner),
):
    if payload.action not in ("Actioned", "Dismissed"):
        raise HTTPException(status_code=422, detail="action must be 'Actioned' or 'Dismissed'")
    rec = db.query(AgentRecommendation).filter(AgentRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    from sqlalchemy.sql import func
    rec.status = payload.action
    rec.actioned_at = func.current_timestamp()
    rec.actioned_by_user_id = current_user.id
    db.commit()
    db.refresh(rec)
    return _rec_out(rec)
