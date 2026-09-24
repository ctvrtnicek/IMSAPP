"""
ai_assistant.py — R3 #12 (PRD §5.17) embedded AI assistant.

A passive assistant: it reads, interprets and explains IMS data and processes, and can
acknowledge alerts. Everything it does runs **as the signed-in user** — tools use the
same data scoping (backend/scoping.py) and role rights as the UI, so it can never see or
do more than the user could.

Knowledge: backend/assistant_knowledge/process_guide.md (how the system works today —
kept current with every process change) goes into the cached system prompt; the PRDs and
test cases are reference documents the model can search with `read_reference`.

Model and switches come from System Config (ai_config.py): AI_MODEL (platform-wide),
ANTHROPIC_API_KEY, AI_ASSISTANT_ENABLED, AI_ASSISTANT_ROLES.

Wire format to the browser (Server-Sent Events, one JSON object per `data:` line):
  {"type": "conversation", "id": 12}        conversation id (first event)
  {"type": "text", "text": "..."}           streamed answer text
  {"type": "tool", "name": "get_order"}     a tool is running (for a status hint)
  {"type": "done"} | {"type": "error", "message": "..."}
"""
import json
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

import anthropic
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ai_config import FALLBACK_BETA, FALLBACK_MODELS, get_ai_model, get_api_key
from models import (
    AIConversation, AIMessage, Alert, AlertRule, Location, NonSerialisedInventory,
    OutboundOrder, Product, PurchaseOrder, RepairOrder, ReturnOrder, SafetyStockTarget,
    SerialNumber, StateHistory, TerminalState, User, WorkOrder,
)
from scoping import Scope, build_scope

KNOWLEDGE_DIR = Path(__file__).parent / "assistant_knowledge"
REFERENCE_DOCS = {
    "prd_v3": "reference_prd_v3.md",          # R3 requirements (incl. agents appendix)
    "prd_v1_3": "reference_prd_v1_3.md",      # R1/R2 functional spec
    "test_cases": "reference_test_cases.md",
}
MAX_TOOL_ROUNDS = 8
MAX_HISTORY_MESSAGES = 80
CLOSED = ("Shipped", "Delivered", "Cancelled", "Closed")

SYSTEM_INSTRUCTIONS = """You are the IMS Assistant, built into the Inventory Management System (IMS) of Terminal Distributor, a global distributor of serialised payment terminals.

Your job: help the signed-in user understand and use IMS. You read, interpret and explain data (orders, terminals, stock, alerts), explain how processes work, and you can acknowledge alerts. You do not create or change orders, stock or master data - when the user wants that, explain where and how to do it in the UI and which role is needed.

How to work:
- Use the tools to look at live data before answering questions about specific orders, terminals, stock or alerts. Never guess numbers, statuses or dates.
- Tools run with the user's own rights and data visibility. If something is not found, it may be outside what this user can see - say so plainly instead of speculating.
- For "how do I..." questions, answer from the Process Guide below: give short numbered steps, name the menu path, and say which roles can do each step (e.g. "Repair orders are created only from a return inspected as Defective, by Admin/Supply Planner or a Warehouse User at the receiving warehouse"). If the user's role cannot do it, say who can.
- The Process Guide describes the system as it is built today. The PRDs and test cases (read_reference) are background; where they disagree with the Process Guide, the Process Guide is right.
- Acknowledge an alert only when the user asks you to (or clearly agrees), then confirm which alert you acknowledged.
- Write for busy operations staff: plain language, short paragraphs or bullets, order/serial numbers exactly as shown in IMS. Explain codes (e.g. ATP_PARTIAL = only part of the quantity was found).

The Process Guide follows.

"""


# ---------------------------------------------------------------------------
# Knowledge
# ---------------------------------------------------------------------------

def _read(name: str) -> str:
    try:
        return (KNOWLEDGE_DIR / name).read_text(encoding="utf-8")
    except OSError:
        return ""


def system_prompt() -> str:
    # Read on each request so a deployed guide update applies without a restart. The text
    # is stable between requests, so the prompt cache still hits.
    return SYSTEM_INSTRUCTIONS + _read("process_guide.md")


def _search_reference(doc_key: str, query: str, max_chars: int = 6000) -> str:
    text = _read(REFERENCE_DOCS.get(doc_key, ""))
    if not text:
        return f"Unknown document '{doc_key}'. Available: {', '.join(REFERENCE_DOCS)}"
    sections = re.split(r"\n(?=#{1,4} )", text)
    words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2]
    scored = []
    for s in sections:
        low = s.lower()
        head = s.split("\n", 1)[0].lower()
        score = sum(low.count(w) + 5 * head.count(w) for w in words)
        if score:
            scored.append((score, s))
    if not scored:
        return f"No section of {doc_key} mentions: {query}"
    out, used = [], 0
    for _, s in sorted(scored, key=lambda x: -x[0]):
        if used + len(s) > max_chars:
            continue
        out.append(s.strip())
        used += len(s)
    return "\n\n---\n\n".join(out) or sorted(scored, key=lambda x: -x[0])[0][1][:max_chars]


# ---------------------------------------------------------------------------
# Tools — every one takes (db, user, scope, **input) and respects the user's scope
# ---------------------------------------------------------------------------

def _alert_query(db: Session, scope: Scope):
    q = db.query(Alert)
    if not scope.unrestricted:
        q = q.filter(Alert.location_id.in_(scope.location_ids))
    return q


def _alert_out(a: Alert) -> dict:
    return {
        "id": a.id, "rule": a.rule.name if a.rule else None, "severity": a.severity,
        "status": a.status, "message": a.message,
        "location": a.location.code if a.location else None,
        "serial": a.serial.serial_number if a.serial else None,
        "product": a.product.code if a.product else None,
        "created_at": str(a.created_at)[:16] if a.created_at else None,
    }


def tool_list_alerts(db, user, scope, status: str = "New", severity: Optional[str] = None,
                     rule_code: Optional[str] = None, limit: int = 20):
    q = _alert_query(db, scope)
    if status and status != "all":
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)
    if rule_code:
        q = q.join(AlertRule, AlertRule.id == Alert.rule_id).filter(AlertRule.rule_code == rule_code)
    total = q.count()
    rows = q.order_by(Alert.created_at.desc()).limit(max(1, min(int(limit or 20), 50))).all()
    return {"total_matching": total, "alerts": [_alert_out(a) for a in rows]}


def tool_acknowledge_alert(db, user, scope, alert_id: int):
    a = _alert_query(db, scope).filter(Alert.id == int(alert_id)).first()
    if not a:
        return {"error": f"Alert {alert_id} not found or not visible to you"}
    if a.status == "Acknowledged":
        return {"result": "already acknowledged", "alert": _alert_out(a)}
    a.status = "Acknowledged"
    a.acknowledged_at = datetime.now(timezone.utc)
    a.acknowledged_by_user_id = user.id
    db.commit()
    return {"result": "acknowledged", "alert": _alert_out(a)}


def _compact_outbound(o: OutboundOrder) -> dict:
    from routers.outbound_orders import order_to_out
    d = order_to_out(o, include_lines=True)
    keep = ("order_number", "order_type", "status", "customer_name", "fulfilling_location_code",
            "destination_location_code", "atp_delivery_date", "carrier", "tracking_number",
            "shipped_date", "created_at", "accessory_reservations", "kit_terminals",
            "reservation_warnings", "atp_rerun_blocked_reason")
    out = {k: d.get(k) for k in keep if d.get(k) not in (None, [], "")}
    out["lines"] = [{
        "line": l["line_number"], "product": l["product_code"], "qty": l["quantity"],
        "atp_status": l["atp_status"], "bom_status": l["bom_assembly_status"], "edd": l["edd"],
        "fulfilling_location": l["fulfilling_location_code"],
        "component_transfer_orders": l.get("component_transfer_orders") or None,
        "atp_reasoning": (l.get("atp_reasoning") or "")[:2500] or None,
    } for l in d["lines"]]
    out["allocated_serials"] = len(d.get("allocated_serials") or [])
    return out


def tool_get_order(db, user, scope, number: str):
    n = (number or "").strip().upper()
    prefix = n[:2]
    if prefix in ("SO", "RN", "RP", "DS"):
        o = scope.apply(db.query(OutboundOrder), scope.outbound_filter).filter(OutboundOrder.order_number == n).first()
        return _compact_outbound(o) if o else {"error": f"{n} not found or not visible to you"}
    if prefix == "PO":
        from routers.purchase_orders import po_to_out
        po = scope.apply(db.query(PurchaseOrder), scope.po_filter).filter(PurchaseOrder.po_number == n).first()
        return po_to_out(po, include_lines=True) if po else {"error": f"{n} not found or not visible to you"}
    if prefix == "WO":
        from routers.work_orders import _wo_to_out
        wo = scope.apply(db.query(WorkOrder), scope.work_order_filter).filter(WorkOrder.order_number == n).first()
        return _wo_to_out(wo, include_lines=True) if wo else {"error": f"{n} not found or not visible to you"}
    if prefix == "RR":
        from routers.returns import repair_to_out
        ro = scope.apply(db.query(RepairOrder), scope.repair_order_filter).filter(RepairOrder.order_number == n).first()
        return repair_to_out(ro) if ro else {"error": f"{n} not found or not visible to you"}
    if prefix == "RE":
        roles = set(getattr(user, "roles_list", None) or [user.role])
        if roles <= {"repair_centre", "supplier"}:
            return {"error": "Your role has no access to return orders"}
        from routers.returns import return_to_out
        ro = scope.apply(db.query(ReturnOrder), scope.return_filter).filter(ReturnOrder.order_number == n).first()
        return return_to_out(ro) if ro else {"error": f"{n} not found or not visible to you"}
    return {"error": f"Unknown order number format '{number}'. Prefixes: SO, RN, RP, DS, PO, WO, RR, RE"}


def tool_search_inventory(db, user, scope, product_code: Optional[str] = None,
                          location_code: Optional[str] = None, state_code: Optional[str] = None):
    q = (
        db.query(Product.code, Location.code, TerminalState.code, func.count(SerialNumber.id),
                 func.sum(case((SerialNumber.pegged_to_order_id.isnot(None), 1), else_=0)))
        .join(Product, Product.id == SerialNumber.product_id)
        .join(Location, Location.id == SerialNumber.current_location_id)
        .join(TerminalState, TerminalState.id == SerialNumber.current_state_id)
        .filter(SerialNumber.active == 1)
    )
    q = scope.apply(q, scope.serial_filter)
    if product_code:
        q = q.filter(Product.code == product_code)
    if location_code:
        q = q.filter(Location.code == location_code)
    if state_code:
        q = q.filter(TerminalState.code == state_code.upper())
    rows = q.group_by(Product.code, Location.code, TerminalState.code).all()
    terminals = sorted(
        [{"product": p, "location": l, "state": s, "count": n, "pegged_to_orders": int(pg or 0)} for p, l, s, n, pg in rows],
        key=lambda r: -r["count"],
    )[:60]
    acc_q = db.query(Product.code, Location.code, NonSerialisedInventory.state, NonSerialisedInventory.quantity) \
        .join(Product, Product.id == NonSerialisedInventory.product_id) \
        .join(Location, Location.id == NonSerialisedInventory.location_id)
    if not scope.unrestricted:
        acc_q = acc_q.filter(NonSerialisedInventory.location_id.in_(scope.location_ids))
    if product_code:
        acc_q = acc_q.filter(Product.code == product_code)
    if location_code:
        acc_q = acc_q.filter(Location.code == location_code)
    accessories = [{"product": p, "location": l, "state": s, "quantity": q_} for p, l, s, q_ in acc_q.all()]
    return {"terminals_by_product_location_state": terminals, "accessories": accessories}


def tool_get_terminal(db, user, scope, serial_number: str):
    s = scope.apply(db.query(SerialNumber), scope.serial_filter) \
        .filter(SerialNumber.serial_number == (serial_number or "").strip()).first()
    if not s:
        return {"error": f"Terminal {serial_number} not found or not visible to you"}
    hist = db.query(StateHistory).filter(StateHistory.serial_number_id == s.id) \
        .order_by(StateHistory.datetime_utc.desc()).limit(20).all()
    pegged = db.query(OutboundOrder.order_number).filter(OutboundOrder.id == s.pegged_to_order_id).scalar() \
        if s.pegged_to_order_id else None
    return {
        "serial_number": s.serial_number, "product": s.product.code if s.product else None,
        "state": s.current_state.code if s.current_state else None,
        "location": s.current_location.code if s.current_location else None,
        "stock_type": s.stock_type, "pegged_to_order": pegged,
        "firmware": s.firmware.version if s.firmware_id and s.firmware else None,
        "accumulated_cost": s.accumulated_cost,
        "history_newest_first": [{
            "when": str(h.datetime_utc)[:16], "state": h.state.code if h.state else None,
            "location": h.location.code if h.location else None,
            "order": getattr(h, "order_reference", None), "notes": h.notes,
        } for h in hist],
    }


def attention_summary(db: Session, user: User, scope: Scope) -> dict:
    """Opening card: unacknowledged alerts, stock below reorder point, orders past EDD —
    computed directly (no model call), within the user's visibility."""
    by_sev = dict(
        _alert_query(db, scope).filter(Alert.status == "New")
        .with_entities(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all()
    )
    available = db.query(TerminalState.id).filter(TerminalState.code == "AVAILABLE").scalar()
    below = []
    tq = db.query(SafetyStockTarget)
    if not scope.unrestricted:
        tq = tq.filter(SafetyStockTarget.location_id.in_(scope.location_ids))
    for t in tq.all():
        on_hand = db.query(func.count(SerialNumber.id)).filter(
            SerialNumber.product_id == t.product_id, SerialNumber.current_location_id == t.location_id,
            SerialNumber.current_state_id == available, SerialNumber.active == 1).scalar() or 0
        on_hand += db.query(func.coalesce(func.sum(NonSerialisedInventory.quantity), 0)).filter(
            NonSerialisedInventory.product_id == t.product_id, NonSerialisedInventory.location_id == t.location_id,
            NonSerialisedInventory.state == "Available").scalar() or 0
        if on_hand < (t.reorder_point or 0):
            below.append({
                "product": db.query(Product.code).filter(Product.id == t.product_id).scalar(),
                "location": db.query(Location.code).filter(Location.id == t.location_id).scalar(),
                "available": int(on_hand), "reorder_point": t.reorder_point,
            })
    today = date.today().isoformat()
    oq = scope.apply(db.query(OutboundOrder), scope.outbound_filter).filter(
        OutboundOrder.status.notin_(CLOSED), OutboundOrder.atp_delivery_date.isnot(None),
        OutboundOrder.atp_delivery_date < today)
    past = [{"order": o.order_number, "status": o.status, "edd": str(o.atp_delivery_date)[:10]}
            for o in oq.order_by(OutboundOrder.atp_delivery_date).limit(20).all()]
    return {
        "alerts_new": {"critical": by_sev.get("Critical", 0), "urgent": by_sev.get("Urgent", 0),
                       "normal": by_sev.get("Normal", 0)},
        "below_reorder_point": below[:20],
        "orders_past_edd": past,
    }


def tool_attention_summary(db, user, scope):
    return attention_summary(db, user, scope)


def tool_read_reference(db, user, scope, document: str, query: str):
    return {"document": document, "excerpt": _search_reference(document, query)}


def _tool(name, description, properties, required):
    return {
        "name": name, "description": description, "eager_input_streaming": True,
        "input_schema": {"type": "object", "properties": properties, "required": required,
                         "additionalProperties": False},
    }


TOOLS = [
    _tool("list_alerts",
          "List alerts the user can see, newest first. Default status 'New' (unacknowledged); use 'all' for every status.",
          {"status": {"type": "string", "description": "New | Acknowledged | all"},
           "severity": {"type": "string", "description": "Critical | Urgent | Normal"},
           "rule_code": {"type": "string", "description": "e.g. RETURN_RECEIVED, LOW_STOCK, COMPONENT_SHORTAGE"},
           "limit": {"type": "integer", "description": "max rows, default 20, at most 50"}}, []),
    _tool("acknowledge_alert",
          "Acknowledge one alert (marks it handled, recorded under the user's name). Only when the user asks.",
          {"alert_id": {"type": "integer"}}, ["alert_id"]),
    _tool("get_order",
          "Get one order by its number: SO/RN/RP (sales, rental, replacement), DS (distribution), PO (purchase), "
          "WO (work order), RR (repair order), RE (return order). Outbound orders include ATP status and reasoning, "
          "EDD, BOM/component status, reservations and component transfer orders.",
          {"number": {"type": "string", "description": "e.g. SO000030, PO000012, WO000026"}}, ["number"]),
    _tool("search_inventory",
          "Count terminals by product, location and state (and list accessory stock) within the user's visibility. "
          "All filters optional.",
          {"product_code": {"type": "string"}, "location_code": {"type": "string"},
           "state_code": {"type": "string", "description": "e.g. AVAILABLE, QUARANTINE, IN_REPAIR"}}, []),
    _tool("get_terminal",
          "One terminal by serial number: current state, location, order it is pegged to, and recent state history.",
          {"serial_number": {"type": "string"}}, ["serial_number"]),
    _tool("attention_summary",
          "What needs attention now: unacknowledged alerts by severity, stock below reorder point, open orders past their EDD.",
          {}, []),
    _tool("read_reference",
          "Search reference documents for background: prd_v3 (R3 requirements, agents), prd_v1_3 (R1/R2 functional spec), "
          "test_cases. The Process Guide in your instructions describes the current system and takes precedence.",
          {"document": {"type": "string", "enum": list(REFERENCE_DOCS)},
           "query": {"type": "string", "description": "keywords, e.g. 'repair order return'"}}, ["document", "query"]),
]

TOOL_FUNCS = {
    "list_alerts": tool_list_alerts, "acknowledge_alert": tool_acknowledge_alert,
    "get_order": tool_get_order, "search_inventory": tool_search_inventory,
    "get_terminal": tool_get_terminal, "attention_summary": tool_attention_summary,
    "read_reference": tool_read_reference,
}
TOOL_SCHEMAS = {t["name"]: t["input_schema"] for t in TOOLS}


def _valid_input(name: str, args: Any) -> bool:
    """Eager input streaming means the server doesn't validate tool input — check it here."""
    schema = TOOL_SCHEMAS.get(name)
    if schema is None or not isinstance(args, dict):
        return False
    props = schema["properties"]
    if any(k not in props for k in args) or any(r not in args for r in schema["required"]):
        return False
    types = {"string": str, "integer": int}
    return all(isinstance(v, types.get(props[k].get("type"), object)) or v is None for k, v in args.items())


def run_tool(db: Session, user: User, scope: Scope, name: str, args: dict) -> str:
    try:
        result = TOOL_FUNCS[name](db, user, scope, **args)
    except Exception as e:  # a failing tool must not end the conversation
        db.rollback()
        result = {"error": f"{type(e).__name__}: {e}"}
    return json.dumps(result, default=str)[:20000]


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------

def _context_block(user: User, scope: Scope, db: Session, page: Optional[str], record: Optional[str]) -> str:
    roles = getattr(user, "roles_list", None) or [user.role]
    if scope.unrestricted:
        vis = "all locations"
    else:
        codes = [c for (c,) in db.query(Location.code).filter(Location.id.in_(scope.location_ids)).all()]
        vis = "locations " + (", ".join(codes) or "none assigned")
    parts = [f"user: {user.username}", f"roles: {', '.join(roles)}", f"data visibility: {vis}",
             f"today: {date.today().isoformat()}"]
    if page:
        parts.append(f"current page: {page}")
    if record:
        parts.append(f"record open on screen: {record}")
    return "<ims_context>\n" + "\n".join(parts) + "\n</ims_context>"


def _history(db: Session, conv: AIConversation) -> List[dict]:
    rows = db.query(AIMessage).filter(AIMessage.conversation_id == conv.id).order_by(AIMessage.id).all()
    return [{"role": m.role, "content": json.loads(m.content)} for m in rows]


def _save(db: Session, conv: AIConversation, role: str, content) -> None:
    db.add(AIMessage(conversation_id=conv.id, role=role, content=json.dumps(content, default=str)))
    db.commit()


def get_or_create_conversation(db: Session, user: User, conversation_id: Optional[int], page: Optional[str]) -> AIConversation:
    if conversation_id:
        conv = db.query(AIConversation).filter(
            AIConversation.id == conversation_id, AIConversation.user_id == user.id).first()
        if conv:
            return conv
    conv = AIConversation(user_id=user.id, session_id=uuid.uuid4().hex, page_context=page)
    db.add(conv)
    db.commit()
    return conv


def visible_messages(db: Session, conv: AIConversation) -> List[dict]:
    """User/assistant text only, for re-rendering the panel."""
    out = []
    for m in _history(db, conv):
        blocks = m["content"] if isinstance(m["content"], list) else [{"type": "text", "text": m["content"]}]
        text = "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        if m["role"] == "user":
            text = re.sub(r"<ims_context>.*?</ims_context>\s*", "", text, flags=re.S)
        if text.strip():
            out.append({"role": m["role"], "text": text.strip()})
    return out


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _request_params(model: str) -> dict:
    """Per-model settings: adaptive thinking + effort where supported; refusal fallback
    (server-side, `fallbacks: "default"`) on the models that accept it."""
    params: Dict[str, Any] = {}
    if not model.startswith("claude-haiku"):
        params["thinking"] = {"type": "adaptive"}
        params["output_config"] = {"effort": "medium"}
    if model in FALLBACK_MODELS:
        params["betas"] = [FALLBACK_BETA]
        params["fallbacks"] = "default"
    return params


def chat_stream(db: Session, user: User, message: str, conversation_id: Optional[int],
                page: Optional[str], record: Optional[str]) -> Iterator[str]:
    api_key = get_api_key(db)
    if not api_key:
        yield _sse({"type": "error", "message": "The AI key is not configured (Admin → System Config → ANTHROPIC_API_KEY)."})
        return
    scope = build_scope(user, db)
    conv = get_or_create_conversation(db, user, conversation_id, page)
    yield _sse({"type": "conversation", "id": conv.id})

    messages = _history(db, conv)
    # A turn that broke off after a tool call has no tool_result yet — the API would reject
    # the history, so close it with an error result
    if messages and messages[-1]["role"] == "assistant":
        dangling = [b for b in messages[-1]["content"] if isinstance(b, dict) and b.get("type") == "tool_use"]
        if dangling:
            closing = [{"type": "tool_result", "tool_use_id": b["id"], "is_error": True,
                        "content": "Interrupted before the tool ran."} for b in dangling]
            messages.append({"role": "user", "content": closing})
            _save(db, conv, "user", closing)
    if len(messages) >= MAX_HISTORY_MESSAGES:
        yield _sse({"type": "error", "message": "This conversation is long — start a new chat to continue."})
        return
    user_turn = [{"type": "text", "text": _context_block(user, scope, db, page, record) + "\n\n" + message}]
    messages.append({"role": "user", "content": user_turn})
    _save(db, conv, "user", user_turn)

    model = get_ai_model(db)
    params = _request_params(model)
    client = anthropic.Anthropic(api_key=api_key)
    api = client.beta.messages if "betas" in params else client.messages
    system = [{"type": "text", "text": system_prompt(), "cache_control": {"type": "ephemeral"}}]

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            with api.stream(
                model=model, max_tokens=16000, system=system, tools=TOOLS, messages=messages,
                cache_control={"type": "ephemeral"},  # also cache the growing conversation
                **params,
            ) as stream:
                for event in stream:
                    if event.type == "text":
                        yield _sse({"type": "text", "text": event.text})
                    elif event.type == "content_block_start" and getattr(event.content_block, "type", None) == "tool_use":
                        yield _sse({"type": "tool", "name": event.content_block.name})
                response = stream.get_final_message()

            content = [b.model_dump(exclude_none=True) for b in response.content]
            messages.append({"role": "assistant", "content": content})
            _save(db, conv, "assistant", content)

            if response.stop_reason == "refusal":
                yield _sse({"type": "text", "text": "\n\nI can't help with that request."})
                break
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if not tool_uses:
                break
            if response.stop_reason == "max_tokens":
                yield _sse({"type": "error", "message": "The answer was cut off — please ask a narrower question."})
                break

            results = []
            for b in tool_uses:
                if not _valid_input(b.name, b.input):
                    results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": True,
                                    "content": json.dumps({"INVALID_INPUT": b.input}, default=str)})
                    continue
                results.append({"type": "tool_result", "tool_use_id": b.id,
                                "content": run_tool(db, user, scope, b.name, b.input)})
            messages.append({"role": "user", "content": results})  # all results in one message
            _save(db, conv, "user", results)
        yield _sse({"type": "done"})
    except anthropic.AuthenticationError:
        yield _sse({"type": "error", "message": "The AI key was rejected — check ANTHROPIC_API_KEY in System Config."})
    except anthropic.RateLimitError:
        yield _sse({"type": "error", "message": "The AI service is busy (rate limited) — try again in a minute."})
    except anthropic.APIStatusError as e:
        if 400 <= e.status_code < 500:
            # Configuration problems (key/workspace/model) — show the API's own explanation
            detail = (e.body or {}).get("error", {}).get("message") if isinstance(e.body, dict) else None
            yield _sse({"type": "error", "message": f"AI request rejected ({e.status_code}): {detail or e.message}"})
        else:
            yield _sse({"type": "error", "message": f"AI service error ({e.status_code}). Try again later."})
    except anthropic.APIConnectionError:
        yield _sse({"type": "error", "message": "Could not reach the AI service — check the network and try again."})
    except ValueError:
        # Tool input JSON the SDK could not parse at all (eager input streaming)
        yield _sse({"type": "error", "message": "The assistant produced an unreadable tool call — please ask again."})
