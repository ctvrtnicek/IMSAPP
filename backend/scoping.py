"""
scoping.py — location/supplier data-visibility rules (R3 #14 / #16 / #17).

Rule (confirmed with Jakub 2026-09-22):
  A location-scoped user (warehouse_user, repair_centre) with assigned
  locations L sees an object if L is involved in it now OR was at any point
  in the past. Visibility never shrinks once granted.

  * Serial      — current location in L, OR any state_history row at L, OR
                  on a PO / outbound (incl. DS) / repair order that involves L
                  (covers expected + in-transit stock not yet received).
  * PO          — destination in L (from creation, before receipt).
  * SO/RN/RP/DS — fulfilling OR destination location in L (header or line).
  * Repair      — repair centre OR return location in L (both RR tables).
  * Return      — original outbound order visible, OR any serial on it visible.
                  ASSUMPTION: a terminal returns to the warehouse that shipped
                  it. Recorded in SPECS/R3_REMAINING_ITEMS.md; may change.
  * Work order  — location in L.
  * Accessories — location in L (no history for non-serialised stock).
  * Alerts      — unchanged (alerting is being rebuilt in R4).

  Supplier users are scoped to their linked supplier (users.supplier_id):
  POs from that supplier and serials on those POs.

  Multi-role: a user holding any role outside LOCATION/SUPPLIER roles is
  unrestricted (strongest right wins — region scoping for internal roles is
  not implemented yet). A user holding several scoped roles (e.g.
  repair_centre + supplier) sees the union of what each role allows.
"""

from dataclasses import dataclass, field
from typing import Optional, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy import false, or_, select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    DistributionOrder,
    DistributionOrderSerial,
    OutboundOrder,
    OutboundOrderLine,
    OutboundOrderSerial,
    PurchaseOrder,
    RepairOrder,
    RepairOrderSerial,
    RepairReworkOrder,
    RepairReworkSerial,
    ReturnOrder,
    ReturnOrderSerial,
    SerialNumber,
    StateHistory,
    User,
    UserLocation,
    WorkOrder,
)

LOCATION_ROLES = {"warehouse_user", "repair_centre"}
SUPPLIER_ROLES = {"supplier"}
SCOPED_ROLES = LOCATION_ROLES | SUPPLIER_ROLES


@dataclass
class Scope:
    unrestricted: bool = True
    location_ids: Set[int] = field(default_factory=set)
    supplier_id: Optional[int] = None

    # -- helpers -----------------------------------------------------------

    def allows_location(self, location_id: Optional[int]) -> bool:
        return self.unrestricted or (location_id is not None and location_id in self.location_ids)

    # -- SQL filters (return a boolean clause; `true` when unrestricted) ----

    def po_filter(self):
        conds = []
        if self.location_ids:
            conds.append(PurchaseOrder.destination_location_id.in_(self.location_ids))
        if self.supplier_id:
            conds.append(PurchaseOrder.supplier_id == self.supplier_id)
        return or_(*conds) if conds else false()

    def outbound_filter(self):
        if not self.location_ids:
            return false()
        L = self.location_ids
        line_orders = select(OutboundOrderLine.order_id).where(OutboundOrderLine.fulfilling_location_id.in_(L))
        return or_(
            OutboundOrder.fulfilling_location_id.in_(L),
            OutboundOrder.destination_location_id.in_(L),
            OutboundOrder.id.in_(line_orders),
        )

    def repair_order_filter(self):
        if not self.location_ids:
            return false()
        L = self.location_ids
        return or_(RepairOrder.repair_centre_location_id.in_(L), RepairOrder.return_location_id.in_(L))

    def rr_filter(self):
        if not self.location_ids:
            return false()
        L = self.location_ids
        return or_(RepairReworkOrder.location_id.in_(L), RepairReworkOrder.return_location_id.in_(L))

    def work_order_filter(self):
        return WorkOrder.location_id.in_(self.location_ids) if self.location_ids else false()

    def serial_filter(self):
        conds = []
        if self.location_ids:
            L = self.location_ids
            visible_outbound = select(OutboundOrder.id).where(self.outbound_filter())
            conds += [
                SerialNumber.current_location_id.in_(L),
                SerialNumber.id.in_(select(StateHistory.serial_number_id).where(StateHistory.location_id.in_(L))),
                SerialNumber.po_id.in_(select(PurchaseOrder.id).where(PurchaseOrder.destination_location_id.in_(L))),
                SerialNumber.pegged_to_order_id.in_(visible_outbound),
                SerialNumber.id.in_(select(OutboundOrderSerial.serial_id).where(OutboundOrderSerial.order_id.in_(visible_outbound))),
                SerialNumber.id.in_(
                    select(DistributionOrderSerial.serial_id)
                    .join(DistributionOrder, DistributionOrder.id == DistributionOrderSerial.dist_order_id)
                    .where(or_(DistributionOrder.origin_location_id.in_(L), DistributionOrder.destination_location_id.in_(L)))
                ),
                SerialNumber.id.in_(
                    select(RepairReworkSerial.serial_id)
                    .join(RepairReworkOrder, RepairReworkOrder.id == RepairReworkSerial.rr_order_id)
                    .where(self.rr_filter())
                ),
                SerialNumber.id.in_(
                    select(RepairOrderSerial.serial_id)
                    .join(RepairOrder, RepairOrder.id == RepairOrderSerial.repair_order_id)
                    .where(self.repair_order_filter())
                ),
            ]
        if self.supplier_id:
            conds.append(SerialNumber.po_id.in_(select(PurchaseOrder.id).where(PurchaseOrder.supplier_id == self.supplier_id)))
        return or_(*conds) if conds else false()

    def return_filter(self):
        conds = []
        if self.location_ids:
            conds.append(ReturnOrder.original_order_id.in_(select(OutboundOrder.id).where(self.outbound_filter())))
        visible_serials = select(SerialNumber.id).where(self.serial_filter())
        conds.append(ReturnOrder.id.in_(
            select(ReturnOrderSerial.return_order_id).where(ReturnOrderSerial.serial_id.in_(visible_serials))
        ))
        return or_(*conds)

    # -- query appliers ------------------------------------------------------

    def apply(self, query, clause_fn):
        """query.filter(clause) unless unrestricted. Usage: scope.apply(q, scope.po_filter)."""
        return query if self.unrestricted else query.filter(clause_fn())

    def ensure(self, db: Session, model, obj_id: int, clause_fn, not_found: str = "Not found"):
        """404 (not 403 — don't reveal existence) if obj_id isn't visible."""
        if self.unrestricted:
            return
        hit = db.query(model.id).filter(model.id == obj_id).filter(clause_fn()).first()
        if not hit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found)


def build_scope(user: User, db: Session) -> Scope:
    roles = set(getattr(user, "roles_list", None) or ([user.role] if user.role else []))
    if not roles or roles - SCOPED_ROLES:
        return Scope(unrestricted=True)

    scope = Scope(unrestricted=False)
    if roles & LOCATION_ROLES:
        scope.location_ids = {
            r.location_id for r in db.query(UserLocation).filter(UserLocation.user_id == user.id).all()
        }
    if roles & SUPPLIER_ROLES:
        scope.supplier_id = user.supplier_id
    return scope


def get_scope(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Scope:
    """FastAPI dependency: the calling user's visibility scope."""
    return build_scope(current_user, db)
