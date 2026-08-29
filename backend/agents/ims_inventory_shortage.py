"""
IMS_InventoryShortage Agent — v2.0
5-step ReAct loop: INTENT CHECK → DATA GATHERING → LLM REASONING → EXECUTE → RECORD RUN
Full spec: SPECS/IMS_InventoryShortage_Agent_v2.0.docx
"""
import json
import smtplib
import uuid
from collections import Counter
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

AVAILABLE_STATE_CODES = {"AVAILABLE", "AVAILABLE_REFURBISHED"}
AGENT_NAME = "IMS_InventoryShortage"


# ---------------------------------------------------------------------------
# DB / config helpers
# ---------------------------------------------------------------------------
def _get_db():
    from database import SessionLocal
    return SessionLocal()


def _get_config(db: Session, key: str, default=None):
    from models import SystemConfig
    row = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    return row.current_value if row and row.current_value else default


def _avail_state_ids(db: Session) -> list[int]:
    from models import TerminalState
    return [s.id for s in db.query(TerminalState)
            .filter(TerminalState.code.in_(AVAILABLE_STATE_CODES)).all()]


# ---------------------------------------------------------------------------
# Tool: log_action
# ---------------------------------------------------------------------------
def log_action(db: Session, run_id: str, step_type: str, message: str, order_ref: str = None):
    from models import AgentLog
    db.add(AgentLog(run_id=run_id, agent_name=AGENT_NAME,
                    step_type=step_type, message=message, order_ref=order_ref))
    db.commit()


# ---------------------------------------------------------------------------
# Tool: get_safety_stock_targets
# ---------------------------------------------------------------------------
def get_safety_stock_targets(db: Session) -> list[dict]:
    from models import SafetyStockTarget
    rows = db.query(SafetyStockTarget).all()
    return [
        {
            "product_id":    r.product_id,
            "product_code":  r.product.code if r.product else str(r.product_id),
            "product_name":  r.product.name if r.product else "",
            "location_id":   r.location_id,
            "location_code": r.location.code if r.location else str(r.location_id),
            "location_name": r.location.name if r.location else "",
            "location_type": r.location.location_type if r.location else "",
            "min_qty":       r.min_qty,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Tool: get_inventory_snapshot
# ---------------------------------------------------------------------------
def get_inventory_snapshot(db: Session, product_id: int, location_id: int,
                            pipeline_states: list[str]) -> dict:
    from models import SerialNumber, TerminalState, OutboundOrder, PurchaseOrderLine, PurchaseOrder

    avail_ids = _avail_state_ids(db)

    # Available unpegged (can move freely)
    avail_unpegged = db.query(SerialNumber).filter(
        SerialNumber.product_id == product_id,
        SerialNumber.current_location_id == location_id,
        SerialNumber.current_state_id.in_(avail_ids),
        SerialNumber.active == 1,
        SerialNumber.pegged_to_order_id.is_(None),
    ).count()

    # Available pegged (do not touch)
    avail_pegged = db.query(SerialNumber).filter(
        SerialNumber.product_id == product_id,
        SerialNumber.current_location_id == location_id,
        SerialNumber.current_state_id.in_(avail_ids),
        SerialNumber.active == 1,
        SerialNumber.pegged_to_order_id.isnot(None),
    ).count()

    # Pipeline by state
    pipeline_state_rows = db.query(TerminalState).filter(
        TerminalState.code.in_(pipeline_states)).all()
    pipeline_state_ids = {s.id: s.code for s in pipeline_state_rows}
    pipeline_by_state: dict[str, int] = {}
    pipeline_total = 0
    if pipeline_state_ids:
        rows = db.query(SerialNumber).filter(
            SerialNumber.product_id == product_id,
            SerialNumber.current_location_id == location_id,
            SerialNumber.current_state_id.in_(list(pipeline_state_ids.keys())),
            SerialNumber.active == 1,
        ).all()
        for r in rows:
            code = pipeline_state_ids[r.current_state_id]
            pipeline_by_state[code] = pipeline_by_state.get(code, 0) + 1
            pipeline_total += 1

    # Inbound from Distribution Orders (DOs headed to this location)
    inbound_do_rows = db.query(OutboundOrder).filter(
        OutboundOrder.order_type == "Distribution",
        OutboundOrder.destination_location_id == location_id,
        OutboundOrder.status.in_(["Draft", "Confirmed", "Shipped"]),
    ).all()
    inbound_do_qty = 0
    inbound_do_refs = []
    for o in inbound_do_rows:
        for line in o.lines:
            if line.product_id == product_id:
                inbound_do_qty += line.quantity
        inbound_do_refs.append(o.order_number)

    # Inbound from POs (not yet received)
    from models import PurchaseOrder as PO
    inbound_po_qty = 0
    inbound_po_refs = []
    po_lines = db.query(PurchaseOrderLine).filter(
        PurchaseOrderLine.product_id == product_id,
    ).all()
    for pl in po_lines:
        po = db.query(PO).filter(PO.id == pl.po_id).first()
        if not po or po.status in ("Cancelled", "Received", "Closed"):
            continue
        remaining = (pl.qty_ordered or 0) - (pl.qty_received or 0)
        if remaining > 0:
            dest = getattr(po, "destination_location_id", None)
            if dest == location_id:
                inbound_po_qty += remaining
                inbound_po_refs.append(po.order_number if hasattr(po, "order_number") else str(po.id))

    gross_shortage = 0  # caller sets this
    return {
        "available_unpegged": avail_unpegged,
        "available_pegged":   avail_pegged,
        "pipeline_by_state":  pipeline_by_state,
        "pipeline_total":     pipeline_total,
        "inbound_do_qty":     inbound_do_qty,
        "inbound_do_refs":    inbound_do_refs,
        "inbound_po_qty":     inbound_po_qty,
        "inbound_po_refs":    inbound_po_refs,
    }


# ---------------------------------------------------------------------------
# Tool: get_network_surplus
# ---------------------------------------------------------------------------
def get_network_surplus(db: Session, product_id: int, exclude_location_ids: list[int],
                         pipeline_states: list[str]) -> list[dict]:
    from models import SerialNumber, TerminalState, SafetyStockTarget, Location

    avail_ids = _avail_state_ids(db)

    # Aggregate available_unpegged by location
    rows = db.query(SerialNumber).filter(
        SerialNumber.product_id == product_id,
        SerialNumber.active == 1,
        SerialNumber.current_state_id.in_(avail_ids),
        SerialNumber.pegged_to_order_id.is_(None),
    ).all()
    avail_by_loc: dict[int, int] = Counter()
    pegged_by_loc: dict[int, int] = Counter()
    for r in rows:
        if r.current_location_id and r.current_location_id not in exclude_location_ids:
            avail_by_loc[r.current_location_id] += 1

    pegged_rows = db.query(SerialNumber).filter(
        SerialNumber.product_id == product_id,
        SerialNumber.active == 1,
        SerialNumber.current_state_id.in_(avail_ids),
        SerialNumber.pegged_to_order_id.isnot(None),
    ).all()
    for r in pegged_rows:
        if r.current_location_id and r.current_location_id not in exclude_location_ids:
            pegged_by_loc[r.current_location_id] += 1

    # Pipeline by location
    pipeline_state_rows = db.query(TerminalState).filter(
        TerminalState.code.in_(pipeline_states)).all()
    pipeline_ids = {s.id: s.code for s in pipeline_state_rows}
    pipeline_by_loc: dict[int, int] = Counter()
    if pipeline_ids:
        p_rows = db.query(SerialNumber).filter(
            SerialNumber.product_id == product_id,
            SerialNumber.active == 1,
            SerialNumber.current_state_id.in_(list(pipeline_ids.keys())),
        ).all()
        for r in p_rows:
            if r.current_location_id and r.current_location_id not in exclude_location_ids:
                pipeline_by_loc[r.current_location_id] += 1

    # Safety stock targets
    targets = {t.location_id: t.min_qty for t in
               db.query(SafetyStockTarget).filter(SafetyStockTarget.product_id == product_id).all()}

    all_loc_ids = set(avail_by_loc.keys()) | set(pipeline_by_loc.keys())
    result = []
    for loc_id in all_loc_ids:
        loc = db.query(Location).filter(Location.id == loc_id).first()
        if not loc:
            continue
        avail = avail_by_loc.get(loc_id, 0)
        pegged = pegged_by_loc.get(loc_id, 0)
        pipeline = pipeline_by_loc.get(loc_id, 0)
        min_qty = targets.get(loc_id, 0)
        surplus = max(0, avail - min_qty)
        result.append({
            "location_id":   loc_id,
            "location_code": loc.code,
            "location_name": loc.name,
            "location_type": loc.location_type if hasattr(loc, "location_type") else "",
            "available_unpegged": avail,
            "available_pegged":   pegged,
            "pipeline_qty":       pipeline,
            "safety_stock_min":   min_qty,
            "surplus_qty":        surplus,
        })
    return sorted(result, key=lambda x: -x["surplus_qty"])


# ---------------------------------------------------------------------------
# Tool: check_and_execute_intents
# ---------------------------------------------------------------------------
def check_and_execute_intents(db: Session, run_id: str) -> dict:
    from models import AgentAllocationIntent
    from datetime import timedelta

    intents = db.query(AgentAllocationIntent).filter(
        AgentAllocationIntent.status.in_(["Pending", "PartiallyExecuted"]),
        AgentAllocationIntent.agent_name == AGENT_NAME,
    ).all()

    executed_count = 0
    results = []

    for intent in intents:
        # Check expiry
        if intent.horizon_days and intent.created_at:
            age_days = (datetime.now(timezone.utc).replace(tzinfo=None) - intent.created_at).days
            if age_days > intent.horizon_days:
                intent.status = "Expired"
                db.commit()
                log_action(db, run_id, "INTENT_CHECK",
                           f"Intent #{intent.id} ({intent.product.code if intent.product else intent.product_id} "
                           f"{intent.from_location.code if intent.from_location else '?'} -> "
                           f"{intent.to_location.code if intent.to_location else '?'}) "
                           f"EXPIRED after {age_days} days.")
                continue

        avail_ids = _avail_state_ids(db)
        from models import SerialNumber
        avail = db.query(SerialNumber).filter(
            SerialNumber.product_id == intent.product_id,
            SerialNumber.current_location_id == intent.from_location_id,
            SerialNumber.current_state_id.in_(avail_ids),
            SerialNumber.active == 1,
            SerialNumber.pegged_to_order_id.is_(None),
        ).count()

        prod_code = intent.product.code if intent.product else str(intent.product_id)
        from_code = intent.from_location.code if intent.from_location else str(intent.from_location_id)
        to_code   = intent.to_location.code if intent.to_location else str(intent.to_location_id)

        log_action(db, run_id, "INTENT_CHECK",
                   f"Intent #{intent.id}: {prod_code} {from_code} -> {to_code}, "
                   f"remaining_qty={intent.remaining_qty}. Available unpegged at {from_code}: {avail}.")

        if avail <= 0:
            log_action(db, run_id, "INTENT_CHECK",
                       f"Intent #{intent.id}: stock not yet available at {from_code}. Remains PENDING.")
            continue

        exec_qty = min(intent.remaining_qty, avail)
        do_ref = create_distribution_order(db, intent.product_id, intent.from_location_id,
                                           intent.to_location_id, exec_qty, run_id)
        if do_ref:
            existing_refs = intent.execution_do_refs or ""
            intent.execution_do_refs = (existing_refs + "," + do_ref).strip(",")
            intent.remaining_qty -= exec_qty
            if intent.remaining_qty <= 0:
                intent.status = "Executed"
                intent.executed_at = datetime.utcnow()
            else:
                intent.status = "PartiallyExecuted"
            db.commit()
            executed_count += 1
            log_action(db, run_id, "INTENT_EXECUTE",
                       f"Intent #{intent.id} executed: DO {do_ref} ({exec_qty} units {from_code} -> {to_code}). "
                       f"Status: {intent.status}. Remaining: {intent.remaining_qty}.",
                       order_ref=do_ref)
            results.append({"intent_id": intent.id, "do_ref": do_ref, "qty": exec_qty})
        else:
            log_action(db, run_id, "INTENT_CHECK",
                       f"Intent #{intent.id}: DO creation failed. Will retry next run.")

    return {"intents_checked": len(intents), "intents_executed": executed_count, "details": results}


# ---------------------------------------------------------------------------
# Tool: create_allocation_intent
# ---------------------------------------------------------------------------
def create_allocation_intent(db: Session, run_id: str, product_id: int,
                              from_location_id: int, to_location_id: int,
                              qty: int, reasoning: str, horizon_days: int) -> int:
    from models import AgentAllocationIntent
    intent = AgentAllocationIntent(
        run_id=run_id,
        agent_name=AGENT_NAME,
        product_id=product_id,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        reserved_qty=qty,
        remaining_qty=qty,
        reasoning=reasoning,
        status="Pending",
        horizon_days=horizon_days,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)
    return intent.id


# ---------------------------------------------------------------------------
# Tool: create_distribution_order
# ---------------------------------------------------------------------------
def create_distribution_order(db: Session, product_id: int, from_location_id: int,
                               to_location_id: int, qty: int, run_id: str) -> Optional[str]:
    try:
        from models import OutboundOrder, OutboundOrderLine, OrderNumbering
        num_row = (db.query(OrderNumbering)
                   .filter(OrderNumbering.order_type == "DistributionOrder")
                   .with_for_update().first())
        if not num_row:
            num_row = OrderNumbering(order_type="DistributionOrder", prefix="DS",
                                     padding_length=6, current_sequence=0)
            db.add(num_row)
            db.flush()
        num_row.current_sequence += 1
        order_number = f"{num_row.prefix}{str(num_row.current_sequence).zfill(num_row.padding_length)}"

        order = OutboundOrder(
            order_number=order_number,
            order_type="Distribution",
            status="Draft",
            fulfilling_location_id=from_location_id,
            destination_location_id=to_location_id,
        )
        db.add(order)
        db.flush()

        line = OutboundOrderLine(
            order_id=order.id,
            line_number=1,
            product_id=product_id,
            quantity=qty,
        )
        db.add(line)
        db.commit()
        return order_number
    except Exception as e:
        db.rollback()
        return None


# ---------------------------------------------------------------------------
# Tool: create_agent_recommendation
# ---------------------------------------------------------------------------
def create_agent_recommendation(db: Session, run_id: str, rec_type: str,
                                  product_id: int, from_location_id: Optional[int],
                                  to_location_id: int, qty: int, shortage_qty: int,
                                  estimated_value: float, status: str, notes: str,
                                  order_ref: str = None) -> int:
    from models import AgentRecommendation
    rec = AgentRecommendation(
        run_id=run_id, agent_name=AGENT_NAME, rec_type=rec_type,
        product_id=product_id, from_location_id=from_location_id,
        to_location_id=to_location_id, qty=qty, shortage_qty=shortage_qty,
        estimated_value=estimated_value, status=status, order_ref=order_ref, notes=notes,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec.id


# ---------------------------------------------------------------------------
# Tool: send_summary_email
# ---------------------------------------------------------------------------
def send_summary_email(db: Session, run_id: str, summary_lines: list[str]):
    to_addr   = _get_config(db, "AGENT_SHORTAGE_EMAIL_TO", "")
    smtp_host = _get_config(db, "SMTP_HOST", "")
    smtp_port = int(_get_config(db, "SMTP_PORT", "587"))
    smtp_user = _get_config(db, "SMTP_USER", "")
    smtp_pass = _get_config(db, "SMTP_PASSWORD", "")
    smtp_from = _get_config(db, "SMTP_FROM", smtp_user)

    if not to_addr or not smtp_host or not smtp_user:
        return False, "SMTP not configured — email skipped."

    body = "\n".join(summary_lines)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = (f"IMS Shortage Agent — Run Summary "
                      f"({datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC)")
    msg["From"] = smtp_from
    msg["To"] = to_addr
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_addr.split(","), msg.as_string())
        return True, "Email sent."
    except Exception as e:
        return False, f"Email failed: {e}"


# ---------------------------------------------------------------------------
# LLM: claude_api_decide
# ---------------------------------------------------------------------------
def _build_llm_prompt(run_id: str, shortages: list[dict], supply_locations: list[dict],
                       hitl_qty: int, hitl_value: float) -> str:
    lines = [
        "== RUN CONTEXT ==",
        f"Date: {datetime.utcnow().strftime('%Y-%m-%d')} | Run ID: {run_id[:8]}",
        f"HITL Qty Threshold: {hitl_qty} | HITL Value Threshold: EUR {hitl_value:.0f}",
        "",
        "== SHORTAGE LOCATIONS ==",
    ]
    for s in shortages:
        snap = s["snapshot"]
        pipeline_str = ", ".join(f"{k}={v}" for k, v in snap["pipeline_by_state"].items()) or "none"
        inbound_do_str = (f"{snap['inbound_do_qty']} units ({', '.join(snap['inbound_do_refs'])})"
                          if snap["inbound_do_refs"] else "0 units")
        inbound_po_str = (f"{snap['inbound_po_qty']} units ({', '.join(snap['inbound_po_refs'])})"
                          if snap["inbound_po_refs"] else "0 units")
        effective = max(0, s["gross_shortage"] - snap["inbound_do_qty"] - snap["inbound_po_qty"])
        lines += [
            f"LOCATION: {s['location_name']} (type: {s.get('location_type','')}) | "
            f"PRODUCT: {s['product_code']} — {s['product_name']}",
            f"  Safety Stock Min Qty:  {s['min_qty']}",
            f"  Available Unpegged:    {snap['available_unpegged']} units  <- can be moved freely",
            f"  Available Pegged:      {snap['available_pegged']} units  <- RESERVED for customer orders — DO NOT TOUCH",
            f"  Pipeline at location:  {snap['pipeline_total']} units  (states: {pipeline_str})",
            f"  Inbound DO in transit: {inbound_do_str}",
            f"  Inbound PO expected:   {inbound_po_str}",
            f"  Gross shortage:        {s['gross_shortage']} units",
            f"  Effective shortage:    {effective} units  (after in-transit, before pipeline decision)",
            "",
        ]

    lines += ["== NETWORK SUPPLY =="]
    for loc in supply_locations:
        lines += [
            f"LOCATION: {loc['location_name']} (type: {loc.get('location_type','')}) | PRODUCT: same",
            f"  Available Unpegged:  {loc['available_unpegged']} units  "
            f"<- surplus vs min_qty={loc['safety_stock_min']}: {loc['surplus_qty']} units freely available",
            f"  Available Pegged:    {loc['available_pegged']} units",
            f"  Pipeline:            {loc['pipeline_qty']} units",
            f"  Safety Stock Min:    {loc['safety_stock_min']} units",
            "",
        ]

    total_shortage = sum(s["gross_shortage"] for s in shortages)
    total_surplus  = sum(l["surplus_qty"] for l in supply_locations)
    total_pipeline = sum(l["pipeline_qty"] for l in supply_locations)
    coverage = "FULL" if total_surplus >= total_shortage else ("PARTIAL" if total_surplus > 0 else "NONE")

    lines += [
        "== TOTALS ==",
        f"Total gross shortage: {total_shortage} units",
        f"Total freely available surplus (above safety stock): {total_surplus} units",
        f"Total pipeline available for intent reservation: {total_pipeline} units",
        f"Coverage: {coverage}",
        "",
        "== YOUR TASK ==",
        "1. For each shortage location, decide the action and your reasoning.",
        "2. For each supply location with pipeline: decide pipeline_keep_qty vs pipeline_intent_qty.",
        "3. Prioritise FSL locations (direct customer-facing) over Warehouse locations.",
        "4. If effective shortage is low (covered by in-transit/pipeline), use 'monitor' action.",
        "5. Never recommend moving pegged inventory.",
        "6. If shortage qty or estimated value exceeds HITL threshold, use 'pending_approval'.",
        "",
        "Return ONLY a valid JSON array, no markdown, no explanation outside the JSON:",
        '[{"location":"<name>","product_code":"<code>","action":"create_do|pending_approval|no_action|monitor|create_intent",',
        '"from_location":"<name or null>","qty":<int>,"priority":"urgent|normal|low",',
        '"reasoning":"<full explanation>","pipeline_keep_qty":<int>,"pipeline_intent_qty":<int>}]',
    ]
    return "\n".join(lines)


def claude_api_decide(db: Session, run_id: str, prompt: str, api_key: str) -> list[dict]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    system = (
        "You are an expert inventory supply planner for a global payment terminal distributor. "
        "You make allocation decisions across a worldwide warehouse and FSL network. "
        "You must balance shortages across locations, prioritise FSL locations serving direct customer demand, "
        "never recommend moving pegged inventory, and record clear reasoning for every decision. "
        "Always return valid JSON only — no markdown fences, no explanation outside the JSON array."
    )
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Deterministic fallback (v1.0 logic)
# ---------------------------------------------------------------------------
def _fallback_decisions(shortages: list[dict], supply_locations: list[dict],
                         hitl_qty: int, hitl_value: float) -> list[dict]:
    decisions = []
    surplus_locs = [l for l in supply_locations if l["surplus_qty"] > 0]
    for s in shortages:
        snap = s["snapshot"]
        unit_price = s.get("unit_price", 0.0)
        est_value = s["gross_shortage"] * unit_price
        needs_hitl = s["gross_shortage"] > hitl_qty or (est_value > hitl_value and est_value > 0)

        if not surplus_locs:
            decisions.append({
                "location": s["location_name"], "product_code": s["product_code"],
                "action": "pending_approval", "from_location": None, "qty": s["gross_shortage"],
                "priority": "urgent", "reasoning": "[FALLBACK] No network surplus found. Manual PR required.",
                "pipeline_keep_qty": 0, "pipeline_intent_qty": 0,
            })
        elif needs_hitl:
            best = surplus_locs[0]
            decisions.append({
                "location": s["location_name"], "product_code": s["product_code"],
                "action": "pending_approval", "from_location": best["location_name"],
                "qty": s["gross_shortage"], "priority": "urgent",
                "reasoning": f"[FALLBACK] Exceeds HITL threshold. Source: {best['location_code']}.",
                "pipeline_keep_qty": 0, "pipeline_intent_qty": 0,
            })
        else:
            best = surplus_locs[0]
            transfer_qty = min(s["gross_shortage"], best["surplus_qty"])
            decisions.append({
                "location": s["location_name"], "product_code": s["product_code"],
                "action": "create_do", "from_location": best["location_name"],
                "qty": transfer_qty, "priority": "normal",
                "reasoning": f"[FALLBACK] Auto-transfer {transfer_qty} units from {best['location_code']}.",
                "pipeline_keep_qty": 0, "pipeline_intent_qty": 0,
            })
    return decisions


# ---------------------------------------------------------------------------
# Main ReAct loop — v2.0
# ---------------------------------------------------------------------------
def run_shortage_agent(triggered_by: str = "scheduler") -> dict:
    db = _get_db()
    run_id = str(uuid.uuid4())
    summary: list[str] = []
    actions_taken = 0
    hitl_items = 0
    intents_recorded = 0
    intents_executed_count = 0
    fallback_mode = False

    # Create agent_run record immediately
    from models import AgentRun
    run_record = AgentRun(run_id=run_id, agent_name=AGENT_NAME,
                          triggered_by=triggered_by, status="running")
    db.add(run_record)
    db.commit()

    try:
        # Read config
        enabled = _get_config(db, "AGENT_SHORTAGE_ENABLED", "0")
        if enabled not in ("1", "true"):
            run_record.status = "skipped"
            run_record.completed_at = datetime.utcnow()
            db.commit()
            return {"run_id": run_id, "status": "skipped", "reason": "Agent disabled."}

        hitl_qty    = int(_get_config(db, "AGENT_SHORTAGE_HITL_QTY", "100"))
        hitl_value  = float(_get_config(db, "AGENT_SHORTAGE_HITL_VALUE", "5000"))
        min_shortage = int(_get_config(db, "AGENT_SHORTAGE_MIN_SHORTAGE", "1"))
        api_key     = _get_config(db, "ANTHROPIC_API_KEY", "")
        pipeline_states_cfg = _get_config(db, "AGENT_PIPELINE_STATES",
                                           "RECEIVED,STAGING,QC_HOLD,RECHARGED,KEYLOADED")
        pipeline_states = [s.strip() for s in pipeline_states_cfg.split(",") if s.strip()]
        horizon_days = int(_get_config(db, "AGENT_INTENT_HORIZON_DAYS", "14"))

        summary.append(f"IMS_InventoryShortage Agent v2.0 — Run {run_id}")
        summary.append(f"Started: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC | Triggered by: {triggered_by}")
        summary.append("-" * 60)

        # ── STEP 1: INTENT CHECK ─────────────────────────────────────────
        log_action(db, run_id, "THINK", "STEP 1: Loading all PENDING / PARTIALLY_EXECUTED allocation intents.")
        intent_result = check_and_execute_intents(db, run_id)
        intents_executed_count = intent_result["intents_executed"]
        log_action(db, run_id, "OBSERVE",
                   f"Intent check complete. Checked: {intent_result['intents_checked']}, "
                   f"Executed: {intent_result['intents_executed']}.")
        if intent_result["intents_executed"] > 0:
            for d in intent_result["details"]:
                summary.append(f"  [INTENT] DO {d['do_ref']} auto-created ({d['qty']} units) from Intent #{d['intent_id']}")

        # ── STEP 2: DATA GATHERING ───────────────────────────────────────
        log_action(db, run_id, "THINK", "STEP 2: Loading safety stock targets and building inventory snapshots.")
        targets = get_safety_stock_targets(db)
        log_action(db, run_id, "OBSERVE", f"Loaded {len(targets)} safety stock target(s).")

        if not targets:
            log_action(db, run_id, "SUMMARY", "No safety stock targets defined. Nothing to evaluate.")
            run_record.status = "completed"
            run_record.completed_at = datetime.utcnow()
            db.commit()
            return {"run_id": run_id, "status": "completed", "shortages_found": 0,
                    "actions_taken": 0, "hitl_items": 0}

        # Build shortage list with full snapshots
        shortages = []
        shortage_location_ids = []
        for t in targets:
            snap = get_inventory_snapshot(db, t["product_id"], t["location_id"], pipeline_states)
            gross_shortage = t["min_qty"] - snap["available_unpegged"]
            if gross_shortage >= min_shortage:
                try:
                    from models import Product
                    prod = db.query(Product).filter(Product.id == t["product_id"]).first()
                    unit_price = float(prod.unit_value or 0) if prod and prod.unit_value else 0.0
                except Exception:
                    unit_price = 0.0
                shortages.append({**t, "snapshot": snap, "gross_shortage": gross_shortage,
                                   "unit_price": unit_price})
                shortage_location_ids.append(t["location_id"])
                log_action(db, run_id, "OBSERVE",
                           f"SHORTAGE: {t['product_code']} @ {t['location_code']} — "
                           f"available_unpegged={snap['available_unpegged']}, min_qty={t['min_qty']}, "
                           f"gross_shortage={gross_shortage}, pipeline={snap['pipeline_total']}, "
                           f"inbound_do={snap['inbound_do_qty']}, inbound_po={snap['inbound_po_qty']}.")

        log_action(db, run_id, "THINK",
                   f"Evaluated {len(targets)} targets. Found {len(shortages)} shortage(s).")
        summary.append(f"Safety stock targets evaluated: {len(targets)}")
        summary.append(f"Shortages detected: {len(shortages)}")

        if not shortages:
            log_action(db, run_id, "SUMMARY", "No shortages detected. All locations above minimum stock.")
            run_record.status = "completed"
            run_record.shortages_found = 0
            run_record.intents_executed = intents_executed_count
            run_record.completed_at = datetime.utcnow()
            db.commit()
            send_summary_email(db, run_id, summary)
            return {"run_id": run_id, "status": "completed", "shortages_found": 0,
                    "actions_taken": 0, "hitl_items": 0, "intents_executed": intents_executed_count}

        # Get network surplus for the products in shortage
        product_ids_in_shortage = list({s["product_id"] for s in shortages})
        supply_locations = []
        for pid in product_ids_in_shortage:
            locs = get_network_surplus(db, pid, shortage_location_ids, pipeline_states)
            for loc in locs:
                loc["product_id"] = pid
                loc["product_code"] = next(
                    (s["product_code"] for s in shortages if s["product_id"] == pid), str(pid))
            supply_locations.extend(locs)
            log_action(db, run_id, "OBSERVE",
                       f"Network surplus for product {pid}: "
                       + ", ".join(f"{l['location_code']}(surplus={l['surplus_qty']},pipeline={l['pipeline_qty']})"
                                   for l in locs) or "none")

        # ── STEP 3: LLM REASONING ────────────────────────────────────────
        log_action(db, run_id, "THINK",
                   "STEP 3: Compiling inventory data for LLM reasoning. Calling Claude API.")
        decisions = []
        if api_key:
            try:
                prompt = _build_llm_prompt(run_id, shortages, supply_locations, hitl_qty, hitl_value)
                decisions = claude_api_decide(db, run_id, prompt, api_key)
                log_action(db, run_id, "LLM_REASONING",
                           f"Claude API returned {len(decisions)} decision(s).")
                for d in decisions:
                    log_action(db, run_id, "LLM_REASONING",
                               f"[{d.get('location','')} | {d.get('action','')} | qty={d.get('qty',0)} | "
                               f"priority={d.get('priority','')}] {d.get('reasoning','')}")
            except Exception as e:
                log_action(db, run_id, "LLM_REASONING",
                           f"Claude API call FAILED: {e}. Falling back to deterministic logic.")
                fallback_mode = True
        else:
            log_action(db, run_id, "LLM_REASONING",
                       "ANTHROPIC_API_KEY not configured. Falling back to deterministic logic.")
            fallback_mode = True

        if fallback_mode:
            decisions = _fallback_decisions(shortages, supply_locations, hitl_qty, hitl_value)

        log_action(db, run_id, "OBSERVE",
                   f"Decisions to execute: {len(decisions)}. Fallback mode: {fallback_mode}.")

        # ── STEP 4: EXECUTE DECISIONS ────────────────────────────────────
        log_action(db, run_id, "THINK", "STEP 4: Executing decisions.")

        # Build location_name -> (id, product_id) lookup from supply_locations
        loc_lookup: dict[str, dict] = {}
        for loc in supply_locations:
            key = loc["location_name"].lower()
            loc_lookup[key] = loc
            loc_lookup[loc["location_code"].lower()] = loc

        shortage_lookup: dict[str, dict] = {}
        for s in shortages:
            shortage_lookup[s["location_name"].lower()] = s
            shortage_lookup[s["location_code"].lower()] = s

        for d in decisions:
            loc_name = d.get("location", "")
            shortage = shortage_lookup.get(loc_name.lower())
            if not shortage:
                continue

            action        = d.get("action", "no_action")
            qty           = int(d.get("qty") or 0)
            from_loc_name = d.get("from_location") or ""
            reasoning     = d.get("reasoning", "")
            priority      = d.get("priority", "normal")
            pipeline_intent_qty = int(d.get("pipeline_intent_qty") or 0)

            supply_loc = loc_lookup.get(from_loc_name.lower()) if from_loc_name else None
            from_location_id = supply_loc["location_id"] if supply_loc else None
            product_id = shortage["product_id"]
            unit_price = shortage.get("unit_price", 0.0)
            est_value  = qty * unit_price

            prod_label = f"{shortage['product_code']} @ {shortage['location_code']}"

            if action == "create_do" and from_location_id and qty > 0:
                log_action(db, run_id, "ACT",
                           f"{prod_label}: Creating DO — {qty} units from {from_loc_name}.")
                do_ref = create_distribution_order(db, product_id, from_location_id,
                                                    shortage["location_id"], qty, run_id)
                rec_status = "Actioned" if do_ref else "PendingApproval"
                create_agent_recommendation(
                    db, run_id, "DO", product_id, from_location_id, shortage["location_id"],
                    qty, shortage["gross_shortage"], est_value, rec_status,
                    f"[LLM] {reasoning}", order_ref=do_ref)
                log_action(db, run_id, "OBSERVE",
                           f"DO {do_ref} created." if do_ref else "DO creation failed — recommendation set to PendingApproval.",
                           order_ref=do_ref)
                if do_ref:
                    actions_taken += 1
                    summary.append(f"  [DO] {prod_label}: {qty} units from {from_loc_name} -> {do_ref}")
                else:
                    hitl_items += 1
                    summary.append(f"  [HITL] {prod_label}: DO creation failed — PendingApproval")

            elif action == "pending_approval":
                log_action(db, run_id, "ACT",
                           f"{prod_label}: Creating PendingApproval recommendation. Reason: {reasoning[:80]}")
                create_agent_recommendation(
                    db, run_id, "DO" if from_location_id else "PurchaseRequisition",
                    product_id, from_location_id, shortage["location_id"],
                    qty, shortage["gross_shortage"], est_value, "PendingApproval",
                    f"[LLM] {reasoning}")
                hitl_items += 1
                summary.append(f"  [HITL] {prod_label}: shortage {shortage['gross_shortage']} — PendingApproval")

            elif action in ("no_action", "monitor"):
                log_action(db, run_id, "OBSERVE",
                           f"{prod_label}: {action.upper()} — {reasoning[:120]}")
                summary.append(f"  [{action.upper()}] {prod_label}: {reasoning[:80]}")

            # Pipeline intent
            if pipeline_intent_qty > 0 and supply_loc and from_location_id:
                log_action(db, run_id, "ACT",
                           f"Creating Allocation Intent: {pipeline_intent_qty} units "
                           f"{from_loc_name} -> {shortage['location_code']} (pipeline reservation).")
                intent_id = create_allocation_intent(
                    db, run_id, product_id, from_location_id, shortage["location_id"],
                    pipeline_intent_qty, reasoning, horizon_days)
                intents_recorded += 1
                log_action(db, run_id, "OBSERVE",
                           f"Allocation Intent #{intent_id} recorded (status=Pending, horizon={horizon_days} days).")
                summary.append(f"  [INTENT] {prod_label}: {pipeline_intent_qty} units reserved from "
                                f"{from_loc_name} pipeline -> Intent #{intent_id}")

        # ── STEP 5: RECORD RUN ───────────────────────────────────────────
        fallback_note = " [FALLBACK MODE]" if fallback_mode else ""
        summary.append("")
        summary.append(f"Actions taken (auto DOs): {actions_taken}{fallback_note}")
        summary.append(f"Items requiring human review: {hitl_items}")
        summary.append(f"New allocation intents recorded: {intents_recorded}")
        summary.append(f"Intents executed this run: {intents_executed_count}")
        summary.append(f"Review pending items at: Admin -> Agentic -> Agent Recommendations")

        log_action(db, run_id, "SUMMARY",
                   f"Run complete{fallback_note}. Shortages: {len(shortages)}, "
                   f"Actions: {actions_taken}, HITL: {hitl_items}, "
                   f"Intents recorded: {intents_recorded}, Intents executed: {intents_executed_count}.")

        run_record.status = "completed"
        run_record.shortages_found = len(shortages)
        run_record.actions_taken = actions_taken
        run_record.hitl_items = hitl_items
        run_record.intents_recorded = intents_recorded
        run_record.intents_executed = intents_executed_count
        run_record.summary_text = "\n".join(summary)
        run_record.completed_at = datetime.utcnow()
        db.commit()

        email_ok, email_msg = send_summary_email(db, run_id, summary)
        log_action(db, run_id, "ACT", f"Email: {email_msg}")

        return {
            "run_id":           run_id,
            "status":           "completed",
            "shortages_found":  len(shortages),
            "actions_taken":    actions_taken,
            "hitl_items":       hitl_items,
            "intents_recorded": intents_recorded,
            "intents_executed": intents_executed_count,
            "fallback_mode":    fallback_mode,
            "summary":          summary,
        }

    except Exception as e:
        log_action(db, run_id, "SUMMARY", f"Agent run FAILED with exception: {e}")
        run_record.status = "error"
        run_record.summary_text = str(e)
        run_record.completed_at = datetime.utcnow()
        db.commit()
        return {"run_id": run_id, "status": "error", "error": str(e)}
    finally:
        db.close()
