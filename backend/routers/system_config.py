from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import SystemConfig, User

router = APIRouter(prefix="/api/system-config", tags=["system-config"])

MASKED_KEYS = {"ANTHROPIC_API_KEY"}


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def config_to_out(c: SystemConfig, mask: bool = True) -> dict:
    value = c.current_value
    if mask and c.config_key in MASKED_KEYS and value:
        value = "***"
    return {
        "id": c.id,
        "config_key": c.config_key,
        "label": c.label,
        "description": c.description,
        "data_type": c.data_type,
        "current_value": value,
        "default_value": c.default_value,
        "updated_at": str(c.updated_at) if c.updated_at else None,
        "updated_by_user_id": c.updated_by_user_id,
    }


class ConfigUpdate(BaseModel):
    current_value: str


@router.get("", response_model=List[dict])
def list_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rows = db.query(SystemConfig).order_by(SystemConfig.config_key).all()
    return [config_to_out(r) for r in rows]


@router.get("/{config_key}", response_model=dict)
def get_config(
    config_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Config key not found")
    return config_to_out(row)


@router.put("/{config_key}", response_model=dict)
def update_config(
    config_key: str,
    payload: ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Config key not found")

    # Validate value type
    val = payload.current_value
    if row.data_type == "boolean" and val not in ("0", "1", "true", "false"):
        raise HTTPException(status_code=422, detail="Boolean value must be 0, 1, true, or false")
    if row.data_type == "integer":
        try:
            int(val)
        except ValueError:
            raise HTTPException(status_code=422, detail="Integer value required")
    if row.data_type == "decimal":
        try:
            float(val)
        except ValueError:
            raise HTTPException(status_code=422, detail="Decimal value required")

    row.current_value = val
    row.updated_by_user_id = current_user.id
    from sqlalchemy.sql import func
    row.updated_at = func.current_timestamp()
    db.commit()
    db.refresh(row)
    return config_to_out(row)


@router.get("/public/ai-enabled", response_model=dict)
def get_ai_enabled(db: Session = Depends(get_db)):
    """Public endpoint — returns whether AI assistant is enabled (no auth required for UI toggle)."""
    row = db.query(SystemConfig).filter(SystemConfig.config_key == "AI_ASSISTANT_ENABLED").first()
    enabled = row.current_value in ("1", "true") if row else False
    return {"enabled": enabled}
