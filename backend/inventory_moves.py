"""
inventory_moves.py — Inventory Moves report (month-end ownership / jurisdiction moves).

A *move* is the point in a terminal's state history where its location changes. Moves
are classified by the location types at both ends ("company" = Warehouse or FSL):

  CROSS_BORDER     company → company in a different country (same-country moves are
                   ignored: stock stays in the same jurisdiction)       route per pair
  TO_CUSTOMER      company → customer   (leaves the company's books)   → ‹all customers›
  TO_PARTNER       company → partner                                    → ‹all partners›
  TO_REPAIR        company → repair centre                              → ‹all repair centres›
  FROM_CUSTOMER    customer / partner → company (returns)               ‹all customers› →
  FROM_REPAIR      repair centre → company                              ‹all repair centres› →

Which date a move counts on (System Config, default arrival):
  MOVES_DATE_BASIS_SALES (to customer / partner), MOVES_DATE_BASIS_DISTRIBUTION (cross
  border), MOVES_DATE_BASIS_REPAIR (to repair). "arrival" = the history row at the new
  location; "departure" = the preceding transit row at the origin (ship / dispatch).
  Returns into a warehouse always count on arrival (receipt).

Values per terminal (EUR):
  standard_value   product master unit_value (refurb_unit_value for Refurbished stock),
                   converted at the latest FX rate effective on or before the period end
  accumulated_cost costs booked on the terminal's history up to and including the move
"""
from calendar import monthrange
from collections import defaultdict
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ai_config import get_config
from models import (
    Country, ExchangeRateMaster, Location, LocationType, Product, SerialNumber, StateHistory,
    TerminalState,
)
from scoping import Scope

COMPANY_TYPES = ("Warehouse", "FSL")
EXTERNAL = {"Customer": ("customers", "TO_CUSTOMER", "FROM_CUSTOMER"),
            "Partner": ("partners", "TO_PARTNER", "FROM_CUSTOMER"),
            "Repair Centre": ("repair centres", "TO_REPAIR", "FROM_REPAIR")}
CATEGORY_LABELS = {
    "CROSS_BORDER": "Cross-border between company locations",
    "TO_CUSTOMER": "To customers (out of the books)",
    "TO_PARTNER": "To partners",
    "TO_REPAIR": "To repair centres",
    "FROM_CUSTOMER": "Returns from customers / partners",
    "FROM_REPAIR": "Returns from repair centres",
}
CATEGORY_ORDER = list(CATEGORY_LABELS)
BASIS_KEY = {"CROSS_BORDER": "MOVES_DATE_BASIS_DISTRIBUTION", "TO_CUSTOMER": "MOVES_DATE_BASIS_SALES",
             "TO_PARTNER": "MOVES_DATE_BASIS_SALES", "TO_REPAIR": "MOVES_DATE_BASIS_REPAIR"}
ALL_LABEL = {"customers": "ALL_CUSTOMERS", "partners": "ALL_PARTNERS", "repair centres": "ALL_REPAIRS"}


def _country_key(loc: Location, name_to_code: Dict[str, str]) -> str:
    """Comparable country: ISO code if set, else the name mapped via the Country master."""
    if loc.country_code:
        return loc.country_code.upper()
    c = (loc.country or "").strip()
    if len(c) == 2:
        return c.upper()
    return name_to_code.get(c.lower(), c.upper())


def _fx_to_eur(db: Session, currency: Optional[str], on_date: str, cache: dict) -> float:
    cur = (currency or "EUR").upper()
    if cur == "EUR":
        return 1.0
    if cur not in cache:
        row = (db.query(ExchangeRateMaster)
               .filter(ExchangeRateMaster.from_currency == cur, ExchangeRateMaster.to_currency == "EUR",
                       ExchangeRateMaster.effective_date <= on_date)
               .order_by(ExchangeRateMaster.effective_date.desc()).first())
        cache[cur] = row.rate if row else 1.0
    return cache[cur]


def extract_moves(db: Session) -> List[dict]:
    """Every location change in the state history, classified (unfiltered)."""
    locs = {l.id: l for l in db.query(Location).all()}
    types = {t.id: t.name for t in db.query(LocationType).all()}
    name_to_code = {c.country_name.lower(): c.country_code.upper() for c in db.query(Country).all()}
    transit_ids = {s.id for s in db.query(TerminalState).filter(TerminalState.code.like("TRANSIT%"))}
    basis = {k: (get_config(db, k, "arrival") or "arrival").lower() for k in set(BASIS_KEY.values())}

    rows = (db.query(StateHistory.serial_number_id, StateHistory.datetime_utc, StateHistory.location_id,
                     StateHistory.state_id, StateHistory.order_reference, StateHistory.activity_cost,
                     StateHistory.reporting_currency_equiv)
            .order_by(StateHistory.serial_number_id, StateHistory.datetime_utc, StateHistory.id).all())
    moves, prev, cum_cost = [], None, 0.0
    for r in rows:
        if prev is None or prev.serial_number_id != r.serial_number_id:
            prev, cum_cost = None, 0.0
        cum_cost += (r.reporting_currency_equiv if r.reporting_currency_equiv is not None else (r.activity_cost or 0))
        if prev is not None and prev.location_id and r.location_id and prev.location_id != r.location_id:
            src, dst = locs.get(prev.location_id), locs.get(r.location_id)
            st, dt = types.get(src.location_type_id) if src else None, types.get(dst.location_type_id) if dst else None
            category, from_label, to_label = None, None, None
            if st in COMPANY_TYPES and dt in COMPANY_TYPES:
                if _country_key(src, name_to_code) != _country_key(dst, name_to_code):
                    category, from_label, to_label = "CROSS_BORDER", src.code, dst.code
            elif st in COMPANY_TYPES and dt in EXTERNAL:
                group, category, _ = EXTERNAL[dt]
                from_label, to_label = src.code, ALL_LABEL[group]
            elif st in EXTERNAL and dt in COMPANY_TYPES:
                group, _, category = EXTERNAL[st]
                from_label, to_label = ALL_LABEL[group], dst.code
            if category:
                use_departure = (category in BASIS_KEY and basis[BASIS_KEY[category]] == "departure"
                                 and prev.state_id in transit_ids)
                when = prev.datetime_utc if use_departure else r.datetime_utc
                moves.append({
                    "serial_id": r.serial_number_id, "category": category,
                    "from_label": from_label, "to_label": to_label,
                    "from_location_id": src.id, "to_location_id": dst.id,
                    "date": str(when)[:10], "arrival": str(r.datetime_utc)[:10],
                    "departure": str(prev.datetime_utc)[:10] if prev.state_id in transit_ids else None,
                    "order_reference": r.order_reference or prev.order_reference,
                    "accumulated_cost": round(cum_cost, 2),
                })
        prev = r
    return moves


def moves_report(db: Session, scope: Scope, period: str, from_label: Optional[str] = None,
                 to_label: Optional[str] = None) -> dict:
    """Aggregate moves of one month (YYYY-MM) by category, route and product."""
    year, month = int(period[:4]), int(period[5:7])
    period_end = f"{period}-{monthrange(year, month)[1]:02d}"
    moves = [m for m in extract_moves(db) if m["date"][:7] == period]
    if not scope.unrestricted:
        moves = [m for m in moves if m["from_location_id"] in scope.location_ids or m["to_location_id"] in scope.location_ids]
    if from_label:
        moves = [m for m in moves if m["from_label"] == from_label]
    if to_label:
        moves = [m for m in moves if m["to_label"] == to_label]

    serials = {s.id: s for s in db.query(SerialNumber).filter(SerialNumber.id.in_({m["serial_id"] for m in moves}))} if moves else {}
    products = {p.id: p for p in db.query(Product).all()}
    fx_cache: dict = {}
    groups: Dict[tuple, dict] = {}
    for m in moves:
        s = serials.get(m["serial_id"])
        p = products.get(s.product_id) if s else None
        refurb = bool(s and (s.stock_type or "").lower().startswith("refurb") and p and p.refurb_unit_value is not None)
        value = (p.refurb_unit_value if refurb else p.unit_value) if p else None
        cur = (p.refurb_unit_currency if refurb else p.unit_currency) if p else "EUR"
        std = round((value or 0) * _fx_to_eur(db, cur, period_end, fx_cache), 2)
        key = (m["category"], m["from_label"], m["to_label"], p.code if p else "?")
        g = groups.setdefault(key, {
            "category": m["category"], "category_label": CATEGORY_LABELS[m["category"]],
            "from": m["from_label"], "to": m["to_label"], "product_code": p.code if p else None,
            "product_name": p.name if p else None, "quantity": 0, "standard_value_eur": 0.0,
            "accumulated_cost_eur": 0.0, "serials": [],
        })
        g["quantity"] += 1
        g["standard_value_eur"] = round(g["standard_value_eur"] + std, 2)
        g["accumulated_cost_eur"] = round(g["accumulated_cost_eur"] + m["accumulated_cost"], 2)
        g["serials"].append({
            "serial_id": m["serial_id"], "serial_number": s.serial_number if s else None,
            "date": m["date"], "departure": m["departure"], "arrival": m["arrival"],
            "order_reference": m["order_reference"], "standard_value_eur": std,
            "accumulated_cost_eur": m["accumulated_cost"],
        })
    rows = sorted(groups.values(), key=lambda g: (CATEGORY_ORDER.index(g["category"]), g["from"], g["to"], g["product_code"] or ""))
    totals = defaultdict(lambda: {"quantity": 0, "standard_value_eur": 0.0, "accumulated_cost_eur": 0.0})
    for g in rows:
        t = totals[g["category"]]
        t["quantity"] += g["quantity"]
        t["standard_value_eur"] = round(t["standard_value_eur"] + g["standard_value_eur"], 2)
        t["accumulated_cost_eur"] = round(t["accumulated_cost_eur"] + g["accumulated_cost_eur"], 2)
    return {
        "period": period,
        "date_basis": {k: (get_config(db, k, "arrival") or "arrival") for k in sorted(set(BASIS_KEY.values()))},
        "rows": rows,
        "category_totals": [{"category": c, "category_label": CATEGORY_LABELS[c], **totals[c]} for c in CATEGORY_ORDER if c in totals],
    }


def moves_filters(db: Session, scope: Scope) -> dict:
    """Months with moves, and the from/to options the report can filter on."""
    moves = extract_moves(db)
    if not scope.unrestricted:
        moves = [m for m in moves if m["from_location_id"] in scope.location_ids or m["to_location_id"] in scope.location_ids]
    return {
        "periods": sorted({m["date"][:7] for m in moves}, reverse=True),
        "from": sorted({m["from_label"] for m in moves}),
        "to": sorted({m["to_label"] for m in moves}),
    }
