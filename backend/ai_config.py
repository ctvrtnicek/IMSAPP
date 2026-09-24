"""
ai_config.py — platform-wide AI settings (R3 #12), read from System Config.

  AI_MODEL              one Claude model for every AI feature (assistant, document
                        processor, shortage agent) — admin picks it in System Config
  ANTHROPIC_API_KEY     masked; never leaves the backend
  AI_ASSISTANT_ENABLED  master switch for the assistant
  AI_ASSISTANT_ROLES    comma-separated roles that get the assistant
"""
from typing import Optional

from sqlalchemy.orm import Session

from models import SystemConfig, User

DEFAULT_MODEL = "claude-opus-5"

# Offered in the System Config dropdown (current models — see the Claude API docs)
AI_MODEL_CHOICES = [
    ("claude-opus-5", "Claude Opus 5 — default"),
    ("claude-sonnet-5", "Claude Sonnet 5 — lower cost"),
    ("claude-haiku-4-5", "Claude Haiku 4.5 — fastest, lowest cost"),
    ("claude-fable-5-1", "Claude Fable 5.1 — most capable, highest cost"),
]

# Models that accept the server-side refusal fallback (`fallbacks: "default"`)
FALLBACK_MODELS = {"claude-opus-5", "claude-fable-5-1"}
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def get_config(db: Session, key: str, default: Optional[str] = None) -> Optional[str]:
    row = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    if row is None or row.current_value in (None, ""):
        return default
    return row.current_value


def get_ai_model(db: Session) -> str:
    return get_config(db, "AI_MODEL", DEFAULT_MODEL)


def get_api_key(db: Session) -> Optional[str]:
    return get_config(db, "ANTHROPIC_API_KEY")


def assistant_enabled_for(db: Session, user: User) -> bool:
    """Master switch on AND at least one of the user's roles is in AI_ASSISTANT_ROLES."""
    if get_config(db, "AI_ASSISTANT_ENABLED", "0") not in ("1", "true"):
        return False
    allowed = {r.strip() for r in (get_config(db, "AI_ASSISTANT_ROLES", "") or "").split(",") if r.strip()}
    roles = set(getattr(user, "roles_list", None) or [user.role])
    return bool(roles & allowed)


def first_text(message) -> str:
    """Text of the first text block. Current models may return thinking blocks first,
    so never read content[0].text blindly."""
    return next((b.text for b in message.content if b.type == "text"), "")
