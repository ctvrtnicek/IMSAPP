"""
assistant.py — R3 #12 AI Assistant API. Prefix: /api/assistant

  GET  /status                       is the assistant on for me (master switch + my roles)
  GET  /summary                      opening "needs attention" card (no model call)
  POST /chat                         streamed answer (Server-Sent Events) — see ai_assistant.py
  GET  /conversations/{id}           my conversation's messages, to re-render the panel
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import ai_assistant
from ai_config import assistant_enabled_for, get_ai_model
from auth import get_current_user
from database import SessionLocal, get_db
from models import AIConversation, User, UserRole
from scoping import build_scope

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class ChatPayload(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    page: Optional[str] = None      # e.g. "Orders / Sales"
    record: Optional[str] = None    # e.g. "SO000030" when a detail page is open


def _require_enabled(db: Session, user: User):
    if not assistant_enabled_for(db, user):
        raise HTTPException(403, "The AI Assistant is not enabled for your role")


@router.get("/status")
def status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"enabled": assistant_enabled_for(db, current_user), "model": get_ai_model(db)}


@router.get("/summary")
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_enabled(db, current_user)
    return ai_assistant.attention_summary(db, current_user, build_scope(current_user, db))


@router.post("/chat")
def chat(payload: ChatPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_enabled(db, current_user)
    if not payload.message.strip():
        raise HTTPException(400, "Empty message")
    user_id = current_user.id

    def events():
        # Own session: the request's session may be closed before a long stream ends
        s = SessionLocal()
        try:
            user = s.query(User).filter(User.id == user_id).first()
            role_rows = s.query(UserRole).filter(UserRole.user_id == user_id).all()
            user.roles_list = [r.role_code for r in role_rows] or [user.role]
            yield from ai_assistant.chat_stream(
                s, user, payload.message.strip()[:4000], payload.conversation_id, payload.page, payload.record)
        finally:
            s.close()

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/conversations/{conversation_id}")
def conversation(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id, AIConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {"id": conv.id, "messages": ai_assistant.visible_messages(db, conv)}
