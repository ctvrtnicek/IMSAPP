from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, get_password_hash, ALL_ROLES
from database import get_db
from models import Location, Region, Supplier, User, UserLocation, UserRegion, UserRole

router = APIRouter(prefix="/api/users", tags=["users"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str  # primary/legacy role
    roles: Optional[List[str]] = None  # R3: multi-role list
    default_location_id: Optional[int] = None
    location_ids: Optional[List[int]] = None
    region_ids: Optional[List[int]] = None
    supplier_id: Optional[int] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    roles: Optional[List[str]] = None
    default_location_id: Optional[int] = None
    location_ids: Optional[List[int]] = None
    region_ids: Optional[List[int]] = None
    active: Optional[int] = None
    supplier_id: Optional[int] = None


class UserPasswordReset(BaseModel):
    new_password: str


class RoleAssignment(BaseModel):
    role_codes: List[str]


class LocationAssignment(BaseModel):
    location_ids: List[int]


class RegionAssignment(BaseModel):
    region_ids: List[int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, 'roles_list', [current_user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def user_to_out(u: User, db: Session) -> dict:
    # Fetch multi-roles
    role_rows = db.query(UserRole).filter(UserRole.user_id == u.id).all()
    roles_list = [r.role_code for r in role_rows] if role_rows else ([u.role] if u.role else [])

    # Fetch assigned locations
    loc_rows = db.query(UserLocation).filter(UserLocation.user_id == u.id).all()
    location_ids = [r.location_id for r in loc_rows]

    # Fetch location details
    locations = []
    for lid in location_ids:
        loc = db.query(Location).filter(Location.id == lid).first()
        if loc:
            locations.append({"id": loc.id, "code": loc.code, "name": loc.name})

    # Fetch assigned regions
    reg_rows = db.query(UserRegion).filter(UserRegion.user_id == u.id).all()
    region_ids = [r.region_id for r in reg_rows]

    regions = []
    for rid in region_ids:
        reg = db.query(Region).filter(Region.id == rid).first()
        if reg:
            regions.append({"id": reg.id, "code": reg.region_code, "name": reg.region_name})

    supplier = db.query(Supplier).filter(Supplier.id == u.supplier_id).first() if u.supplier_id else None

    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "roles": roles_list,
        "default_location_id": u.default_location_id,
        "location_ids": location_ids,
        "locations": locations,
        "region_ids": region_ids,
        "regions": regions,
        "active": u.active,
        "supplier_id": u.supplier_id,
        "supplier_name": supplier.name if supplier else None,
        "created_at": str(u.created_at) if u.created_at else None,
    }


def _sync_roles(user_id: int, role_codes: List[str], db: Session):
    """Replace a user's role assignments with the given list."""
    for code in role_codes:
        if code not in ALL_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid role code: {code}. Must be one of: {', '.join(sorted(ALL_ROLES))}",
            )
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    for code in role_codes:
        db.add(UserRole(user_id=user_id, role_code=code))


def _sync_locations(user_id: int, location_ids: List[int], db: Session):
    for lid in location_ids:
        if not db.query(Location).filter(Location.id == lid).first():
            raise HTTPException(status_code=404, detail=f"Location {lid} not found")
    db.query(UserLocation).filter(UserLocation.user_id == user_id).delete()
    for lid in location_ids:
        db.add(UserLocation(user_id=user_id, location_id=lid))


def _sync_regions(user_id: int, region_ids: List[int], db: Session):
    for rid in region_ids:
        if not db.query(Region).filter(Region.id == rid).first():
            raise HTTPException(status_code=404, detail=f"Region {rid} not found")
    db.query(UserRegion).filter(UserRegion.user_id == user_id).delete()
    for rid in region_ids:
        db.add(UserRegion(user_id=user_id, region_id=rid))


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[dict])
def list_users(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.active == 1)
    users = query.order_by(User.username).all()
    return [user_to_out(u, db) for u in users]


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.role not in ALL_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(ALL_ROLES))}",
        )

    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    new_user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        email=payload.email,
        role=payload.role,
        default_location_id=payload.default_location_id,
        supplier_id=payload.supplier_id,
        active=1,
    )
    db.add(new_user)
    db.flush()  # get new_user.id

    # Assign roles: use explicit list if provided, else fallback to single role
    roles_to_assign = payload.roles if payload.roles else [payload.role]
    _sync_roles(new_user.id, roles_to_assign, db)

    if payload.location_ids:
        _sync_locations(new_user.id, payload.location_ids, db)
    elif payload.default_location_id:
        db.add(UserLocation(user_id=new_user.id, location_id=payload.default_location_id))

    if payload.region_ids:
        _sync_regions(new_user.id, payload.region_ids, db)

    db.commit()
    db.refresh(new_user)
    return user_to_out(new_user, db)


@router.get("/me", response_model=dict)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return user_to_out(current_user, db)


@router.get("/{user_id}", response_model=dict)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_out(user, db)


@router.put("/{user_id}", response_model=dict)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "role" in update_data and update_data["role"] not in ALL_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role")

    # Update scalar fields
    for field in ("email", "role", "default_location_id", "active", "supplier_id"):
        if field in update_data:
            setattr(user, field, update_data[field])

    # Sync roles if provided
    if "roles" in update_data and update_data["roles"] is not None:
        _sync_roles(user_id, update_data["roles"], db)
        # Keep primary role in sync
        if update_data["roles"]:
            user.role = update_data["roles"][0]

    if "location_ids" in update_data and update_data["location_ids"] is not None:
        _sync_locations(user_id, update_data["location_ids"], db)

    if "region_ids" in update_data and update_data["region_ids"] is not None:
        _sync_regions(user_id, update_data["region_ids"], db)

    db.commit()
    db.refresh(user)
    return user_to_out(user, db)


@router.post("/{user_id}/reset-password", response_model=dict)
def reset_password(
    user_id: int,
    payload: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return user_to_out(user, db)


@router.delete("/{user_id}", response_model=dict)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.active = 0
    db.commit()
    return user_to_out(user, db)


# ---------------------------------------------------------------------------
# Role / Location / Region assignment sub-endpoints
# ---------------------------------------------------------------------------

@router.put("/{user_id}/roles", response_model=dict)
def assign_roles(
    user_id: int,
    payload: RoleAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _sync_roles(user_id, payload.role_codes, db)
    if payload.role_codes:
        user.role = payload.role_codes[0]
    db.commit()
    return user_to_out(user, db)


@router.put("/{user_id}/locations", response_model=dict)
def assign_locations(
    user_id: int,
    payload: LocationAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _sync_locations(user_id, payload.location_ids, db)
    db.commit()
    return user_to_out(user, db)


@router.put("/{user_id}/regions", response_model=dict)
def assign_regions(
    user_id: int,
    payload: RegionAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _sync_regions(user_id, payload.region_ids, db)
    db.commit()
    return user_to_out(user, db)


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

@router.get("/meta/roles", response_model=List[dict])
def list_available_roles(current_user: User = Depends(require_admin)):
    """Return all valid role codes with display labels."""
    ROLE_META = [
        {"code": "admin",              "label": "Admin",               "type": "internal"},
        {"code": "supply_planner",     "label": "Supply Planner",      "type": "internal"},
        {"code": "demand_planner",     "label": "Demand Planner",      "type": "internal"},
        {"code": "warehouse_user",     "label": "Warehouse User",      "type": "internal"},
        {"code": "repair_centre",      "label": "Repair Centre",       "type": "external"},
        {"code": "supplier",           "label": "Supplier User",       "type": "external"},
        {"code": "inbound_specialist", "label": "Inbound Specialist",  "type": "internal"},
        {"code": "outbound_specialist","label": "Outbound Specialist", "type": "internal"},
        {"code": "rma_manager",        "label": "RMA Manager",         "type": "internal"},
        {"code": "senior_management",  "label": "Senior Management",   "type": "internal"},
    ]
    return ROLE_META


@router.get("/meta/regions", response_model=List[dict])
def list_regions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    regions = db.query(Region).filter(Region.active == 1).order_by(Region.region_code).all()
    return [{"id": r.id, "code": r.region_code, "name": r.region_name} for r in regions]
