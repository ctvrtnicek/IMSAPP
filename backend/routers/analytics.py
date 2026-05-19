from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth import get_current_user
from database import get_db
from models import (
    SerialNumber, TerminalState, Location, PurchaseOrder,
    OutboundOrder, ReturnOrder, RepairOrder, User,
    StateHistory, Product,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Summary KPIs
# ---------------------------------------------------------------------------

@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top-level KPI cards."""

    def state_count(code):
        return (
            db.query(func.count(SerialNumber.id))
            .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
            .filter(TerminalState.code == code, SerialNumber.active == 1)
            .scalar() or 0
        )

    total = db.query(func.count(SerialNumber.id)).filter(SerialNumber.active == 1).scalar() or 0
    available = state_count("AVAILABLE")
    available_refurb = state_count("AVAILABLE_REFURBISHED")
    quarantine = state_count("QUARANTINE")
    staging = state_count("STAGING")
    defect = state_count("DEFECT") + state_count("UNDER_INVESTIGATION")
    in_transit = (
        db.query(func.count(SerialNumber.id))
        .join(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .filter(
            TerminalState.code.in_(["TRANSIT_TO_COMPANY", "TRANSIT_TO_WAREHOUSE", "TRANSIT_TO_REPAIR"]),
            SerialNumber.active == 1,
        )
        .scalar() or 0
    )

    open_po_statuses = ["Draft", "Issued", "Partially Received"]
    open_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.status.in_(open_po_statuses))
        .scalar() or 0
    )

    open_ob_statuses = ["Draft", "Issued", "Allocated", "Shipped"]
    open_outbound = (
        db.query(func.count(OutboundOrder.id))
        .filter(OutboundOrder.status.in_(open_ob_statuses))
        .scalar() or 0
    )

    pending_returns = (
        db.query(func.count(ReturnOrder.id))
        .filter(ReturnOrder.status.in_(["Initiated", "Received"]))
        .scalar() or 0
    )

    active_repairs = (
        db.query(func.count(RepairOrder.id))
        .filter(RepairOrder.status.in_(["Dispatched", "Received"]))
        .scalar() or 0
    )

    return {
        "total_terminals": total,
        "available": available,
        "available_refurbished": available_refurb,
        "quarantine": quarantine,
        "staging": staging,
        "defective": defect,
        "in_transit": in_transit,
        "open_purchase_orders": open_pos,
        "open_outbound_orders": open_outbound,
        "pending_returns": pending_returns,
        "active_repairs": active_repairs,
    }


# ---------------------------------------------------------------------------
# Inventory by State
# ---------------------------------------------------------------------------

@router.get("/inventory-by-state")
def inventory_by_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TerminalState.display_name, TerminalState.warehouse_type, func.count(SerialNumber.id))
        .join(SerialNumber, SerialNumber.current_state_id == TerminalState.id)
        .filter(SerialNumber.active == 1)
        .group_by(TerminalState.display_name, TerminalState.warehouse_type)
        .order_by(func.count(SerialNumber.id).desc())
        .all()
    )
    return [{"state": r[0], "warehouse_type": r[1], "count": r[2]} for r in rows]


# ---------------------------------------------------------------------------
# Inventory by Location
# ---------------------------------------------------------------------------

@router.get("/inventory-by-location")
def inventory_by_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Location.code, Location.name, func.count(SerialNumber.id))
        .join(SerialNumber, SerialNumber.current_location_id == Location.id)
        .filter(SerialNumber.active == 1)
        .group_by(Location.code, Location.name)
        .order_by(func.count(SerialNumber.id).desc())
        .all()
    )
    return [{"location_code": r[0], "location_name": r[1], "count": r[2]} for r in rows]


# ---------------------------------------------------------------------------
# Outbound Orders by Status
# ---------------------------------------------------------------------------

@router.get("/outbound-by-status")
def outbound_by_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(OutboundOrder.status, func.count(OutboundOrder.id))
        .group_by(OutboundOrder.status)
        .all()
    )
    return [{"status": r[0], "count": r[1]} for r in rows]


# ---------------------------------------------------------------------------
# Purchase Orders by Status
# ---------------------------------------------------------------------------

@router.get("/po-by-status")
def po_by_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(PurchaseOrder.status, func.count(PurchaseOrder.id))
        .group_by(PurchaseOrder.status)
        .all()
    )
    return [{"status": r[0], "count": r[1]} for r in rows]


# ---------------------------------------------------------------------------
# Stock-type split (Live / Refurbished)
# ---------------------------------------------------------------------------

@router.get("/stock-type-split")
def stock_type_split(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(SerialNumber.stock_type, func.count(SerialNumber.id))
        .filter(SerialNumber.active == 1)
        .group_by(SerialNumber.stock_type)
        .all()
    )
    return [{"stock_type": r[0], "count": r[1]} for r in rows]


# ---------------------------------------------------------------------------
# Cost per Serial Number
# ---------------------------------------------------------------------------

@router.get("/cost-by-serial")
def cost_by_serial(
    search: Optional[str] = Query(None),
    product_code: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    cost_min: Optional[float] = Query(None),
    cost_max: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accumulated cost per active serial number with optional filters."""
    q = (
        db.query(
            SerialNumber.id,
            SerialNumber.serial_number,
            SerialNumber.accumulated_cost,
            SerialNumber.stock_type,
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            TerminalState.display_name.label("state_name"),
            Location.code.label("location_code"),
            Location.name.label("location_name"),
        )
        .outerjoin(Product, SerialNumber.product_id == Product.id)
        .outerjoin(TerminalState, SerialNumber.current_state_id == TerminalState.id)
        .outerjoin(Location, SerialNumber.current_location_id == Location.id)
        .filter(SerialNumber.active == 1)
    )
    if search:
        q = q.filter(SerialNumber.serial_number.ilike(f"%{search}%"))
    if product_code:
        q = q.filter(Product.code == product_code)
    if location_id:
        q = q.filter(SerialNumber.current_location_id == location_id)
    if cost_min is not None:
        q = q.filter(SerialNumber.accumulated_cost >= cost_min)
    if cost_max is not None:
        q = q.filter(SerialNumber.accumulated_cost <= cost_max)

    rows = q.order_by(SerialNumber.accumulated_cost.desc()).limit(500).all()
    return [
        {
            "id": r.id,
            "serial_number": r.serial_number,
            "product_code": r.product_code,
            "product_name": r.product_name,
            "state_name": r.state_name,
            "location_code": r.location_code,
            "location_name": r.location_name,
            "accumulated_cost": round(r.accumulated_cost or 0, 2),
            "stock_type": r.stock_type,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Cost by Location
# ---------------------------------------------------------------------------

@router.get("/cost-by-location")
def cost_by_location(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    state_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Total activity cost aggregated per location from state history."""
    q = (
        db.query(
            Location.id.label("location_id"),
            Location.code.label("location_code"),
            Location.name.label("location_name"),
            func.count(StateHistory.id).label("transitions"),
            func.coalesce(func.sum(StateHistory.reporting_currency_equiv), 0).label("total_cost"),
        )
        .join(Location, StateHistory.location_id == Location.id)
        .outerjoin(TerminalState, StateHistory.state_id == TerminalState.id)
        .filter(StateHistory.reporting_currency_equiv.isnot(None))
    )
    if date_from:
        q = q.filter(StateHistory.datetime_utc >= date_from)
    if date_to:
        q = q.filter(StateHistory.datetime_utc <= date_to + " 23:59:59")
    if location_id:
        q = q.filter(StateHistory.location_id == location_id)
    if state_code:
        q = q.filter(TerminalState.code == state_code)

    rows = q.group_by(Location.id, Location.code, Location.name).order_by(func.sum(StateHistory.reporting_currency_equiv).desc()).all()
    return [
        {
            "location_id": r.location_id,
            "location_code": r.location_code,
            "location_name": r.location_name,
            "transitions": r.transitions,
            "total_cost": round(float(r.total_cost), 2),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Cost by Product
# ---------------------------------------------------------------------------

@router.get("/cost-by-product")
def cost_by_product(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    product_code: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Total cost and serial count aggregated per product."""
    q = (
        db.query(
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            func.count(func.distinct(SerialNumber.id)).label("serial_count"),
            func.coalesce(func.sum(SerialNumber.accumulated_cost), 0).label("total_cost"),
        )
        .join(SerialNumber, SerialNumber.product_id == Product.id)
        .filter(SerialNumber.active == 1)
    )
    if product_code:
        q = q.filter(Product.code == product_code)
    if location_id:
        q = q.filter(SerialNumber.current_location_id == location_id)
    # For date filtering on accumulated cost, we use state history join
    if date_from or date_to:
        sh_q = db.query(StateHistory.serial_number_id).filter(
            StateHistory.reporting_currency_equiv.isnot(None)
        )
        if date_from:
            sh_q = sh_q.filter(StateHistory.datetime_utc >= date_from)
        if date_to:
            sh_q = sh_q.filter(StateHistory.datetime_utc <= date_to + " 23:59:59")
        serial_ids = [r[0] for r in sh_q.distinct().all()]
        if serial_ids:
            q = q.filter(SerialNumber.id.in_(serial_ids))
        else:
            return []

    rows = q.group_by(Product.code, Product.name).order_by(func.sum(SerialNumber.accumulated_cost).desc()).all()
    return [
        {
            "product_code": r.product_code,
            "product_name": r.product_name,
            "serial_count": r.serial_count,
            "total_cost": round(float(r.total_cost), 2),
            "avg_cost": round(float(r.total_cost) / r.serial_count, 2) if r.serial_count else 0,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Repair Cost Analysis
# ---------------------------------------------------------------------------

@router.get("/repair-cost-analysis")
def repair_cost_analysis(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    product_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actual repair costs per repair centre and product."""
    from models import RepairOrderSerial
    q = (
        db.query(
            Location.code.label("repair_centre_code"),
            Location.name.label("repair_centre_name"),
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            func.count(func.distinct(RepairOrder.id)).label("repair_count"),
            func.avg(RepairOrder.actual_cost).label("avg_actual"),
            func.sum(RepairOrder.actual_cost).label("total_actual"),
        )
        .join(Location, RepairOrder.repair_centre_location_id == Location.id)
        .join(RepairOrderSerial, RepairOrderSerial.repair_order_id == RepairOrder.id)
        .join(SerialNumber, RepairOrderSerial.serial_id == SerialNumber.id)
        .join(Product, SerialNumber.product_id == Product.id)
        .filter(RepairOrder.actual_cost.isnot(None))
    )
    if date_from:
        q = q.filter(RepairOrder.created_at >= date_from)
    if date_to:
        q = q.filter(RepairOrder.created_at <= date_to + " 23:59:59")
    if location_id:
        q = q.filter(RepairOrder.repair_centre_location_id == location_id)
    if product_code:
        q = q.filter(Product.code == product_code)

    rows = q.group_by(
        Location.code, Location.name, Product.code, Product.name
    ).order_by(Location.code, Product.code).all()

    return [
        {
            "repair_centre_code": r.repair_centre_code,
            "repair_centre_name": r.repair_centre_name,
            "product_code": r.product_code,
            "product_name": r.product_name,
            "repair_count": r.repair_count,
            "avg_actual_cost": round(float(r.avg_actual or 0), 2),
            "total_actual_cost": round(float(r.total_actual or 0), 2),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Dashboard Map — locations + suppliers with terminal counts
# ---------------------------------------------------------------------------

# Approximate country centroid coordinates for geocoding by country name
COUNTRY_COORDS = {
    "Australia": (-25.27, 133.77), "Austria": (47.52, 14.55), "Belgium": (50.50, 4.47),
    "Brazil": (-14.23, -51.92), "Canada": (56.13, -106.35), "Chile": (-35.68, -71.54),
    "China": (35.86, 104.19), "Czech Republic": (49.82, 15.47), "Denmark": (56.26, 9.50),
    "Egypt": (26.82, 30.80), "Finland": (61.92, 25.75), "France": (46.23, 2.21),
    "Germany": (51.17, 10.45), "Greece": (39.07, 21.82), "Hong Kong": (22.32, 114.17),
    "Hungary": (47.16, 19.50), "India": (20.59, 78.96), "Indonesia": (-0.79, 113.92),
    "Ireland": (53.41, -8.24), "Israel": (31.05, 34.85), "Italy": (41.87, 12.57),
    "Japan": (36.20, 138.25), "Jordan": (30.59, 36.24), "Kenya": (-0.02, 37.91),
    "Malaysia": (4.21, 108.97), "Mexico": (23.63, -102.55), "Morocco": (31.79, -7.09),
    "Netherlands": (52.13, 5.29), "New Zealand": (-40.90, 174.89), "Nigeria": (9.08, 8.68),
    "Norway": (60.47, 8.47), "Philippines": (12.88, 121.77), "Poland": (51.92, 19.15),
    "Portugal": (39.40, -8.22), "Romania": (45.94, 24.97), "Russia": (61.52, 105.32),
    "Saudi Arabia": (23.89, 45.08), "Singapore": (1.35, 103.82), "Slovakia": (48.67, 19.70),
    "South Africa": (-30.56, 22.94), "South Korea": (35.91, 127.77), "Spain": (40.46, -3.75),
    "Sweden": (60.13, 18.64), "Switzerland": (46.82, 8.23), "Taiwan": (23.70, 120.96),
    "Thailand": (15.87, 100.99), "Turkey": (38.96, 35.24), "UAE": (23.42, 53.85),
    "UK": (55.38, -3.44), "United Kingdom": (55.38, -3.44), "Ukraine": (48.38, 31.17),
    "USA": (37.09, -95.71), "United States": (37.09, -95.71), "Vietnam": (14.06, 108.28),
    # ISO-2 and common abbreviations
    "NL": (52.13, 5.29), "DE": (51.17, 10.45), "FR": (46.23, 2.21), "BE": (50.50, 4.47),
    "ES": (40.46, -3.75), "IT": (41.87, 12.57), "PL": (51.92, 19.15), "PT": (39.40, -8.22),
    "AU": (-25.27, 133.77), "US": (37.09, -95.71), "GB": (55.38, -3.44), "CA": (56.13, -106.35),
    "SG": (1.35, 103.82), "JP": (36.20, 138.25), "CN": (35.86, 104.19), "IN": (20.59, 78.96),
    "BR": (-14.23, -51.92), "MX": (23.63, -102.55), "ZA": (-30.56, 22.94), "BG": (42.73, 25.49),
    "Bulgaria": (42.73, 25.49), "Slovakia": (48.67, 19.70), "CZ": (49.82, 15.47),
}

def _coords(country: str, city: str = None):
    """Return [lat, lng] for a country, with small jitter per city to avoid overlap."""
    import hashlib
    base = COUNTRY_COORDS.get(country) or COUNTRY_COORDS.get(country.title()) or COUNTRY_COORDS.get(country.upper())
    if not base:
        return None
    lat, lng = base
    if city:
        h = int(hashlib.md5(city.encode()).hexdigest()[:4], 16)
        lat += (h % 20 - 10) * 0.3
        lng += ((h >> 8) % 20 - 10) * 0.3
    return [round(lat, 2), round(lng, 2)]


@router.get("/dashboard-map")
def dashboard_map(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns warehouse/supplier pins with terminal counts for the dashboard map.
    Each pin: { id, type, name, country, city, lat, lng, terminal_count, in_transit_count }
    """
    from models import Supplier, LocationType
    from sqlalchemy import func as sqlfunc

    TRANSIT_CODES = ["TRANSIT_TO_COMPANY", "TRANSIT_TO_WAREHOUSE", "TRANSIT_TO_REPAIR", "EXPECTING"]
    transit_states = db.query(TerminalState).filter(TerminalState.code.in_(TRANSIT_CODES)).all()
    transit_ids = {s.id for s in transit_states}

    pins = []

    # --- Locations (warehouses / company sites) ---
    locations = db.query(Location).filter(Location.active == 1).all()
    for loc in locations:
        coords = _coords(loc.country, loc.city)
        if not coords:
            continue

        total = (
            db.query(sqlfunc.count(SerialNumber.id))
            .filter(SerialNumber.current_location_id == loc.id, SerialNumber.active == 1)
            .scalar() or 0
        )
        in_transit = (
            db.query(sqlfunc.count(SerialNumber.id))
            .filter(
                SerialNumber.current_location_id == loc.id,
                SerialNumber.current_state_id.in_(transit_ids),
                SerialNumber.active == 1,
            )
            .scalar() or 0
        ) if transit_ids else 0

        if total == 0 and in_transit == 0:
            continue

        lt = loc.location_type.name if loc.location_type else ""
        pins.append({
            "id": f"loc-{loc.id}",
            "type": "location",
            "location_type": lt,
            "name": loc.name or loc.code,
            "code": loc.code,
            "country": loc.country,
            "city": loc.city or "",
            "lat": coords[0],
            "lng": coords[1],
            "terminal_count": total,
            "in_transit_count": in_transit,
        })

    # --- Suppliers ---
    from models import Supplier
    suppliers = db.query(Supplier).filter(Supplier.active == 1).all()
    for sup in suppliers:
        coords = _coords(sup.country, sup.city)
        if not coords:
            continue

        # Terminals sourced from this supplier (original supplier on serial)
        total = (
            db.query(sqlfunc.count(SerialNumber.id))
            .filter(SerialNumber.supplier_id == sup.id, SerialNumber.active == 1)
            .scalar() or 0
        )
        if total == 0:
            continue

        pins.append({
            "id": f"sup-{sup.id}",
            "type": "supplier",
            "location_type": "Supplier",
            "name": sup.name,
            "code": sup.code,
            "country": sup.country,
            "city": sup.city or "",
            "lat": coords[0],
            "lng": coords[1],
            "terminal_count": total,
            "in_transit_count": 0,
        })

    return pins
