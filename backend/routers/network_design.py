"""
Phase 3B — Network Design router
Regions, Countries, Network Versions, Supply Flows, Flow Constraints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from auth import get_current_user
from database import get_db
from models import (
    Region, Country, NetworkVersion, SupplyFlow, FlowConstraint, Location, User
)

router = APIRouter(prefix="/api/network-design", tags=["network-design"])


def _require_planner(user: User):
    roles = getattr(user, "roles_list", [user.role])
    allowed = {"admin", "supply_planner"}
    if not any(r in allowed for r in roles):
        raise HTTPException(status_code=403, detail="Admin or Supply Planner only")


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class RegionOut(BaseModel):
    id: int
    region_code: str
    region_name: str
    active: int
    model_config = {"from_attributes": True}


class RegionCreate(BaseModel):
    region_code: str
    region_name: str


class RegionUpdate(BaseModel):
    region_name: Optional[str] = None
    active: Optional[int] = None


class CountryOut(BaseModel):
    id: int
    country_code: str
    country_name: str
    region_id: int
    region_code: Optional[str] = None
    serviced: int
    activated_at: Optional[str] = None
    model_config = {"from_attributes": True}


class CountryCreate(BaseModel):
    country_code: str
    country_name: str
    region_id: int


class CountryUpdate(BaseModel):
    country_name: Optional[str] = None
    region_id: Optional[int] = None
    serviced: Optional[int] = None


class FlowConstraintOut(BaseModel):
    id: int
    flow_id: int
    product_id: Optional[int] = None
    replenishment_type: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    model_config = {"from_attributes": True}


class FlowConstraintCreate(BaseModel):
    product_id: Optional[int] = None
    replenishment_type: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None


class SupplyFlowOut(BaseModel):
    id: int
    network_version_id: int
    from_location_id: int
    to_location_id: int
    from_location_name: Optional[str] = None
    to_location_name: Optional[str] = None
    flow_type: str
    active: int
    constraints: List[FlowConstraintOut] = []
    model_config = {"from_attributes": True}


class SupplyFlowCreate(BaseModel):
    from_location_id: int
    to_location_id: int
    flow_type: str


class NetworkVersionOut(BaseModel):
    id: int
    version_name: str
    version_type: str
    reference_number: Optional[str] = None
    effective_date: Optional[str] = None
    committed_at: Optional[str] = None
    committed_by_user_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    flow_count: int = 0
    model_config = {"from_attributes": True}


class NetworkVersionCreate(BaseModel):
    version_name: str
    version_type: str = "simulation"  # baseline | simulation
    reference_number: Optional[str] = None
    effective_date: Optional[str] = None
    notes: Optional[str] = None


class CommitBaselineRequest(BaseModel):
    reference_number: str
    effective_date: str
    notes: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Regions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/regions", response_model=List[RegionOut])
def list_regions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Region).order_by(Region.region_code).all()


@router.post("/regions", response_model=RegionOut, status_code=201)
def create_region(payload: RegionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    if db.query(Region).filter(Region.region_code == payload.region_code).first():
        raise HTTPException(409, "Region code already exists")
    r = Region(region_code=payload.region_code, region_name=payload.region_name)
    db.add(r); db.commit(); db.refresh(r)
    return r


@router.put("/regions/{region_id}", response_model=RegionOut)
def update_region(region_id: int, payload: RegionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    r = db.query(Region).filter(Region.id == region_id).first()
    if not r: raise HTTPException(404, "Region not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return r


# ─────────────────────────────────────────────────────────────────────────────
# Countries
# ─────────────────────────────────────────────────────────────────────────────

def _country_out(c: Country) -> CountryOut:
    return CountryOut(
        id=c.id, country_code=c.country_code, country_name=c.country_name,
        region_id=c.region_id,
        region_code=c.region.region_code if c.region else None,
        serviced=c.serviced,
        activated_at=str(c.activated_at) if c.activated_at else None,
    )


@router.get("/countries", response_model=List[CountryOut])
def list_countries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [_country_out(c) for c in db.query(Country).order_by(Country.country_name).all()]


@router.post("/countries", response_model=CountryOut, status_code=201)
def create_country(payload: CountryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    if db.query(Country).filter(Country.country_code == payload.country_code).first():
        raise HTTPException(409, "Country code already exists")
    region = db.query(Region).filter(Region.id == payload.region_id).first()
    if not region: raise HTTPException(404, "Region not found")
    c = Country(country_code=payload.country_code, country_name=payload.country_name, region_id=payload.region_id)
    db.add(c); db.commit(); db.refresh(c)
    return _country_out(c)


@router.put("/countries/{country_id}", response_model=CountryOut)
def update_country(country_id: int, payload: CountryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    c = db.query(Country).filter(Country.id == country_id).first()
    if not c: raise HTTPException(404, "Country not found")
    updates = payload.model_dump(exclude_unset=True)
    if "serviced" in updates and updates["serviced"] == 1 and not c.activated_at:
        c.activated_at = datetime.utcnow()
    for k, v in updates.items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _country_out(c)


# ─────────────────────────────────────────────────────────────────────────────
# Network Versions
# ─────────────────────────────────────────────────────────────────────────────

def _version_out(v: NetworkVersion, db: Session) -> NetworkVersionOut:
    flow_count = db.query(SupplyFlow).filter(SupplyFlow.network_version_id == v.id).count()
    return NetworkVersionOut(
        id=v.id, version_name=v.version_name, version_type=v.version_type,
        reference_number=v.reference_number, effective_date=v.effective_date,
        committed_at=str(v.committed_at) if v.committed_at else None,
        committed_by_user_id=v.committed_by_user_id,
        notes=v.notes,
        created_at=str(v.created_at) if v.created_at else None,
        flow_count=flow_count,
    )


@router.get("/versions", response_model=List[NetworkVersionOut])
def list_versions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    versions = db.query(NetworkVersion).order_by(NetworkVersion.id.desc()).all()
    return [_version_out(v, db) for v in versions]


@router.post("/versions", response_model=NetworkVersionOut, status_code=201)
def create_version(payload: NetworkVersionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    v = NetworkVersion(**payload.model_dump())
    db.add(v); db.commit(); db.refresh(v)
    return _version_out(v, db)


@router.post("/versions/{version_id}/commit-baseline", response_model=NetworkVersionOut)
def commit_baseline(version_id: int, payload: CommitBaselineRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Promote a simulation version to active baseline. Only one active baseline at a time."""
    _require_planner(current_user)
    v = db.query(NetworkVersion).filter(NetworkVersion.id == version_id).first()
    if not v: raise HTTPException(404, "Version not found")
    if v.version_type == "baseline" and v.committed_at:
        raise HTTPException(409, "Version is already a committed baseline")

    v.version_type = "baseline"
    v.reference_number = payload.reference_number
    v.effective_date = payload.effective_date
    v.notes = payload.notes or v.notes
    v.committed_at = datetime.utcnow()
    v.committed_by_user_id = current_user.id
    db.commit(); db.refresh(v)
    return _version_out(v, db)


@router.delete("/versions/{version_id}", status_code=204)
def delete_version(version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    v = db.query(NetworkVersion).filter(NetworkVersion.id == version_id).first()
    if not v: raise HTTPException(404, "Version not found")
    if v.committed_at:
        raise HTTPException(409, "Cannot delete a committed baseline")
    db.delete(v); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Supply Flows
# ─────────────────────────────────────────────────────────────────────────────

def _flow_out(f: SupplyFlow) -> SupplyFlowOut:
    return SupplyFlowOut(
        id=f.id, network_version_id=f.network_version_id,
        from_location_id=f.from_location_id, to_location_id=f.to_location_id,
        from_location_name=f.from_location.name if f.from_location else None,
        to_location_name=f.to_location.name if f.to_location else None,
        flow_type=f.flow_type, active=f.active,
        constraints=[FlowConstraintOut.model_validate(c) for c in f.constraints],
    )


@router.get("/versions/{version_id}/flows", response_model=List[SupplyFlowOut])
def list_flows(version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    flows = db.query(SupplyFlow).filter(SupplyFlow.network_version_id == version_id).all()
    return [_flow_out(f) for f in flows]


@router.post("/versions/{version_id}/flows", response_model=SupplyFlowOut, status_code=201)
def add_flow(version_id: int, payload: SupplyFlowCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    v = db.query(NetworkVersion).filter(NetworkVersion.id == version_id).first()
    if not v: raise HTTPException(404, "Version not found")
    if v.committed_at:
        raise HTTPException(409, "Cannot modify a committed baseline; create a new simulation first")
    for loc_id in [payload.from_location_id, payload.to_location_id]:
        if not db.query(Location).filter(Location.id == loc_id).first():
            raise HTTPException(404, f"Location {loc_id} not found")
    f = SupplyFlow(network_version_id=version_id, **payload.model_dump())
    db.add(f); db.commit(); db.refresh(f)
    return _flow_out(f)


@router.delete("/flows/{flow_id}", status_code=204)
def delete_flow(flow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    f = db.query(SupplyFlow).filter(SupplyFlow.id == flow_id).first()
    if not f: raise HTTPException(404, "Flow not found")
    if f.version and f.version.committed_at:
        raise HTTPException(409, "Cannot modify a committed baseline")
    db.delete(f); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Flow Constraints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/flows/{flow_id}/constraints", response_model=FlowConstraintOut, status_code=201)
def add_constraint(flow_id: int, payload: FlowConstraintCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    f = db.query(SupplyFlow).filter(SupplyFlow.id == flow_id).first()
    if not f: raise HTTPException(404, "Flow not found")
    c = FlowConstraint(flow_id=flow_id, **payload.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return FlowConstraintOut.model_validate(c)


@router.delete("/constraints/{constraint_id}", status_code=204)
def delete_constraint(constraint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_planner(current_user)
    c = db.query(FlowConstraint).filter(FlowConstraint.id == constraint_id).first()
    if not c: raise HTTPException(404, "Constraint not found")
    db.delete(c); db.commit()
