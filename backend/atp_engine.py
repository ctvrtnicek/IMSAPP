"""
ATP Engine — Available to Promise
Searches inventory across the supply network to fulfill outbound order lines.
Designed for concurrent execution: all queries are batched, lookups are pre-computed.
"""
from datetime import date, timedelta
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import (
    SerialNumber, TerminalState, Location, Region, Customer, CustomerSegment,
    OutboundOrder, OutboundOrderLine, PurchaseOrder, PurchaseOrderLine,
    TransitTimeLane, ProductAlternative, ProductBomComponent,
    SupplyFlow, NetworkVersion, ATPRule, DistributionOrder, OrderNumbering,
)


class ATPResult:
    """Result of ATP check for a single order line."""
    def __init__(self):
        self.status = "ATP_NONE"  # ATP_OK | ATP_PARTIAL | ATP_NONE
        self.fulfilling_location_id = None
        self.fulfilling_qty = 0
        self.pegged_serial_ids = []
        self.pegged_po_id = None
        self.edd = None
        self.alternative_product_id = None
        self.component_transfers = []  # list of DS order IDs for BOM
        self.reasoning = []  # step-by-step log for transparency
        self.split_details = []  # [{location_id, location_code, qty, edd}]


class ATPContext:
    """Pre-loaded lookup data for ATP. Built once, reused across all lines."""

    def __init__(self, db: Session, customer_id: int):
        self.db = db

        # Load customer + segment
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        self.customer = customer
        self.customer_region_id = None
        if customer and customer.segment:
            self.segment_priority = customer.segment.priority
        else:
            self.segment_priority = 99

        # Determine customer's region from their delivery location or linked locations
        self.customer_region_id = self._resolve_customer_region(customer)

        # Pre-load all regions sorted by proximity to customer region
        self.regions = db.query(Region).filter(Region.active == 1).order_by(Region.id).all()
        self.region_ids_sorted = self._sort_regions_by_proximity()

        # Pre-load current network baseline (supply flows)
        current_version = db.query(NetworkVersion).filter(
            NetworkVersion.is_current == 1,
            NetworkVersion.committed_at.isnot(None)
        ).first()
        self.flows = []
        if current_version:
            self.flows = db.query(SupplyFlow).filter(
                SupplyFlow.network_version_id == current_version.id,
                SupplyFlow.active == 1
            ).all()

        # Build flow map: location_id -> list of (to_location_id, flow_type, lead_time)
        self.outbound_flows = {}
        for f in self.flows:
            if f.from_location_id:
                self.outbound_flows.setdefault(f.from_location_id, []).append(f)

        # Pre-load all transit lanes as lookup
        lanes = db.query(TransitTimeLane).all()
        self.transit_map = {}
        for lane in lanes:
            self.transit_map[(lane.from_location_id, lane.to_location_id)] = lane.lead_time_days

        # Pre-load active locations with their region mapping
        locations = db.query(Location).filter(Location.active == 1).all()
        self.locations = {loc.id: loc for loc in locations}
        self.locations_by_region = {}
        for loc in locations:
            if loc.country_code:
                from models import Country
                country = db.query(Country).filter(Country.country_code == loc.country_code).first()
                if country:
                    self.locations_by_region.setdefault(country.region_id, []).append(loc.id)

        # Pre-load terminal states
        states = db.query(TerminalState).all()
        self.state_map = {s.code: s.id for s in states}
        self.state_id_map = {s.id: s.code for s in states}

        # Pre-load ATP rules
        self.atp_rules = db.query(ATPRule).all()

        # Available state IDs for each ATP step
        self.available_state_ids = [self.state_map.get("AVAILABLE")]
        # QUALITY_HOLD is intentionally excluded — those serials are held until resolved
        self.staging_state_ids = [
            self.state_map.get(code) for code in ["QUARANTINE", "STAGING", "CONFIGURING"]
            if self.state_map.get(code)
        ]
        self.expecting_state_id = self.state_map.get("EXPECTING")

    def _resolve_customer_region(self, customer):
        if not customer:
            return None
        if customer.country:
            from models import Country
            c = self.db.query(Country).filter(
                Country.country_code == customer.country
            ).first()
            if not c:
                c = self.db.query(Country).filter(
                    Country.country_name.ilike(f"%{customer.country}%")
                ).first()
            if c:
                return c.region_id
        return None

    def _sort_regions_by_proximity(self):
        """Sort regions: customer's region first, then others."""
        ids = [r.id for r in self.regions]
        if self.customer_region_id and self.customer_region_id in ids:
            ids.remove(self.customer_region_id)
            ids.insert(0, self.customer_region_id)
        return ids

    def get_transit_days(self, from_loc_id: int, to_loc_id: int) -> int:
        """Get transit lead time between two locations."""
        return self.transit_map.get((from_loc_id, to_loc_id), 14)  # default 14 days


def run_atp_check(
    db: Session,
    order: OutboundOrder,
    line: OutboundOrderLine,
    ctx: ATPContext,
    destination_location_id: int,
) -> ATPResult:
    """
    Run the 7-step ATP search for a single order line.
    Uses pre-computed context for efficiency.
    """
    result = ATPResult()
    product_id = line.product_id
    qty_needed = line.quantity
    qty_found = 0

    product_code = line.product.code if line.product else f"ID:{product_id}"
    result.reasoning.append(f"ATP search for {product_code}, qty needed: {qty_needed}")
    result.reasoning.append(f"Customer region: {ctx.customer_region_id}, search order: {ctx.region_ids_sorted}")

    for region_id in ctx.region_ids_sorted:
        location_ids = ctx.locations_by_region.get(region_id, [])
        loc_names = [ctx.locations[lid].code for lid in location_ids if lid in ctx.locations]
        if not location_ids:
            result.reasoning.append(f"Region {region_id}: no locations mapped — skipped")
            continue

        result.reasoning.append(f"Region {region_id}: searching {loc_names}")

        # Step 1: Available stock at regional locations
        if qty_found < qty_needed and ctx.available_state_ids[0]:
            available_serials = db.query(SerialNumber).filter(
                SerialNumber.product_id == product_id,
                SerialNumber.current_state_id == ctx.available_state_ids[0],
                SerialNumber.current_location_id.in_(location_ids),
                SerialNumber.active == 1,
                SerialNumber.pegged_to_order_id.is_(None),
            ).limit(qty_needed - qty_found).all()

            if available_serials:
                for s in available_serials:
                    result.pegged_serial_ids.append(s.id)
                    qty_found += 1
                    if not result.fulfilling_location_id:
                        result.fulfilling_location_id = s.current_location_id
                loc_code = ctx.locations[available_serials[0].current_location_id].code if available_serials[0].current_location_id in ctx.locations else "?"
                result.reasoning.append(f"  Step 1 (Available): found {len(available_serials)} at {loc_code}, total found: {qty_found}/{qty_needed}")
            else:
                total_avail = db.query(SerialNumber).filter(
                    SerialNumber.product_id == product_id,
                    SerialNumber.current_state_id == ctx.available_state_ids[0],
                    SerialNumber.current_location_id.in_(location_ids),
                    SerialNumber.active == 1,
                ).count()
                pegged_count = total_avail  # all are pegged if unpegged=0
                result.reasoning.append(f"  Step 1 (Available): 0 unpegged ({total_avail} exist but already pegged to other orders)")

        # Step 2: Staging states
        if qty_found < qty_needed and ctx.staging_state_ids:
            staging_serials = db.query(SerialNumber).filter(
                SerialNumber.product_id == product_id,
                SerialNumber.current_state_id.in_(ctx.staging_state_ids),
                SerialNumber.current_location_id.in_(location_ids),
                SerialNumber.active == 1,
                SerialNumber.pegged_to_order_id.is_(None),
            ).limit(qty_needed - qty_found).all()

            if staging_serials:
                for s in staging_serials:
                    result.pegged_serial_ids.append(s.id)
                    qty_found += 1
                    if not result.fulfilling_location_id:
                        result.fulfilling_location_id = s.current_location_id
                result.reasoning.append(f"  Step 2 (Staging): found {len(staging_serials)}, total found: {qty_found}/{qty_needed}")
            else:
                result.reasoning.append(f"  Step 2 (Staging): 0 unpegged in QUARANTINE/STAGING/CONFIGURING")

        # Step 3: Expected (incoming PO serials in EXPECTING state)
        if qty_found < qty_needed and ctx.expecting_state_id:
            expecting_serials = db.query(SerialNumber).filter(
                SerialNumber.product_id == product_id,
                SerialNumber.current_state_id == ctx.expecting_state_id,
                SerialNumber.current_location_id.in_(location_ids),
                SerialNumber.active == 1,
                SerialNumber.pegged_to_order_id.is_(None),
            ).limit(qty_needed - qty_found).all()

            if expecting_serials:
                for s in expecting_serials:
                    result.pegged_serial_ids.append(s.id)
                    qty_found += 1
                    if not result.fulfilling_location_id:
                        result.fulfilling_location_id = s.current_location_id
                result.reasoning.append(f"  Step 3 (Expected/PO incoming): found {len(expecting_serials)}, total found: {qty_found}/{qty_needed}")
            else:
                result.reasoning.append(f"  Step 3 (Expected): 0 unpegged incoming serials")

        # Step 4: On-order (PO Issued, no serials yet)
        if qty_found < qty_needed:
            po_lines = (
                db.query(PurchaseOrderLine)
                .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.po_id)
                .filter(
                    PurchaseOrderLine.product_id == product_id,
                    PurchaseOrder.status == "Issued",
                    PurchaseOrder.destination_location_id.in_(location_ids),
                )
                .all()
            )
            po_found = 0
            for pl in po_lines:
                remaining_on_po = pl.qty_ordered - pl.qty_expected
                can_peg = min(remaining_on_po, qty_needed - qty_found)
                if can_peg > 0:
                    qty_found += can_peg
                    po_found += can_peg
                    result.pegged_po_id = pl.po_id
                    if not result.fulfilling_location_id:
                        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == pl.po_id).first()
                        if po:
                            result.fulfilling_location_id = po.destination_location_id
                if qty_found >= qty_needed:
                    break
            if po_found:
                result.reasoning.append(f"  Step 4 (On-order PO): pegged {po_found} from issued POs, total found: {qty_found}/{qty_needed}")
            else:
                result.reasoning.append(f"  Step 4 (On-order PO): no issued POs with remaining capacity")

        if qty_found >= qty_needed:
            result.reasoning.append(f"Fulfilled: {qty_found}/{qty_needed} — stopping search")
            break

    # Build per-location split details from pegged serials
    loc_counts = {}
    for sid in result.pegged_serial_ids:
        s = db.query(SerialNumber).filter(SerialNumber.id == sid).first()
        if s and s.current_location_id:
            loc_counts[s.current_location_id] = loc_counts.get(s.current_location_id, 0) + 1

    for loc_id, qty in loc_counts.items():
        loc_code = ctx.locations[loc_id].code if loc_id in ctx.locations else "?"
        if destination_location_id:
            transit = ctx.get_transit_days(loc_id, destination_location_id)
        else:
            transit = ctx.get_transit_days(loc_id, loc_id)
        loc_edd = (date.today() + timedelta(days=transit)).isoformat()
        result.split_details.append({
            "location_id": loc_id,
            "location_code": loc_code,
            "qty": qty,
            "edd": loc_edd,
            "transit_days": transit,
        })
        result.reasoning.append(f"Split: {qty} from {loc_code}, EDD {loc_edd} (transit {transit} days)")

    # Overall EDD = latest of all split EDDs
    if result.split_details:
        result.edd = max(d["edd"] for d in result.split_details)
        result.fulfilling_location_id = result.split_details[0]["location_id"]

    # Set status
    if qty_found >= qty_needed:
        result.status = "ATP_OK"
        result.fulfilling_qty = qty_needed
        locs = ", ".join(f"{d['location_code']}({d['qty']})" for d in result.split_details)
        result.reasoning.append(f"Result: ATP_OK — fulfilled from {locs}")
    elif qty_found > 0:
        result.status = "ATP_PARTIAL"
        result.fulfilling_qty = qty_found
        result.reasoning.append(f"Result: ATP_PARTIAL — only {qty_found}/{qty_needed} found across all regions")
    else:
        result.status = "ATP_NONE"
        result.reasoning.append(f"Result: ATP_NONE — no available inventory found in any region for {product_code}")

    return result


def run_atp_for_order(db: Session, order_id: int) -> Dict[int, ATPResult]:
    """
    Run ATP for all lines on an outbound order.
    Returns dict of line_id -> ATPResult.
    """
    order = db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
    if not order:
        return {}

    ctx = ATPContext(db, order.customer_id)
    destination_id = order.destination_location_id

    results = {}
    for line in order.lines:
        atp = run_atp_check(db, order, line, ctx, destination_id)

        # Apply results to line
        line.fulfilling_location_id = atp.fulfilling_location_id
        line.edd = atp.edd
        line.atp_status = atp.status
        line.atp_reasoning = "\n".join(atp.reasoning)
        import json
        line.atp_split_details = json.dumps(atp.split_details) if atp.split_details else None

        # Peg serials
        if atp.pegged_serial_ids:
            for sid in atp.pegged_serial_ids:
                serial = db.query(SerialNumber).filter(SerialNumber.id == sid).first()
                if serial:
                    serial.pegged_to_order_id = order.id

        results[line.id] = atp

    # Update order-level ATP fields
    statuses = [r.status for r in results.values()]
    if all(s == "ATP_OK" for s in statuses):
        order.atp_feasible = 1
    elif any(s != "ATP_NONE" for s in statuses):
        order.atp_feasible = 0  # partial
    else:
        order.atp_feasible = 0

    # Set order EDD to the latest line EDD
    edds = [r.edd for r in results.values() if r.edd]
    if edds:
        order.atp_delivery_date = max(edds)

    db.commit()
    return results


def get_alternative_products(db: Session, product_id: int) -> list:
    """Get ordered list of alternative products for ATP Step 6."""
    alts = (
        db.query(ProductAlternative)
        .filter(ProductAlternative.product_id == product_id)
        .order_by(ProductAlternative.sequence)
        .all()
    )
    return [a.alternative_product_id for a in alts]


def check_bom_availability(
    db: Session,
    order: OutboundOrder,
    line: OutboundOrderLine,
    ctx: ATPContext,
) -> Tuple[str, List[int]]:
    """
    Check if all BOM components are available for a BOM product.
    Returns (status, list_of_auto_drafted_ds_ids).
    """
    from models import Product
    product = db.query(Product).filter(Product.id == line.product_id).first()
    if not product or not product.is_bom:
        return ("COMPLETE", [])

    components = db.query(ProductBomComponent).filter(
        ProductBomComponent.parent_product_id == line.product_id
    ).all()

    if not components:
        return ("COMPLETE", [])

    all_available = True
    ds_ids = []
    warehouse_id = order.fulfilling_location_id or order.destination_location_id

    for comp in components:
        qty_needed = comp.quantity * line.quantity
        # Check available at fulfilling warehouse
        available = db.query(SerialNumber).filter(
            SerialNumber.product_id == comp.component_product_id,
            SerialNumber.current_state_id == ctx.available_state_ids[0],
            SerialNumber.current_location_id == warehouse_id,
            SerialNumber.active == 1,
            SerialNumber.pegged_to_order_id.is_(None),
        ).count() if ctx.available_state_ids[0] else 0

        if available < qty_needed:
            all_available = False

    status = "COMPLETE" if all_available else "PARTIAL"
    return (status, ds_ids)
