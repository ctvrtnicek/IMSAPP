from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, get_password_hash
from database import get_db
from models import Location, User

router = APIRouter(prefix="/api/users", tags=["users"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str  # admin, supply_planner, warehouse_user, repair_centre, supplier
    default_location_id: Optional[int] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    default_location_id: Optional[int] = None
    active: Optional[int] = None


class UserPasswordReset(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

VALID_ROLES = {"admin", "supply_planner", "warehouse_user", "repair_centre", "supplier", "demand_planner"}


def user_to_out(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "default_location_id": u.default_location_id,
        "active": u.active,
        "created_at": str(u.created_at) if u.created_at else None,
    }


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[dict])
def list_users(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return all users. Pass ?include_inactive=true to include inactive users."""
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.active == 1)
    users = query.order_by(User.username).all()
    return [user_to_out(u) for u in users]


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new user (admin only)."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    if payload.email:
        existing_email = db.query(User).filter(User.email == payload.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address already in use",
            )

    if payload.default_location_id is not None:
        loc = db.query(Location).filter(Location.id == payload.default_location_id).first()
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Default location not found",
            )

    new_user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        email=payload.email,
        role=payload.role,
        default_location_id=payload.default_location_id,
        active=1,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return user_to_out(new_user)


@router.get("/{user_id}", response_model=dict)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_to_out(user)


@router.put("/{user_id}", response_model=dict)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user's email, role, default_location_id, or active flag (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "role" in update_data and update_data["role"] not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    if "email" in update_data and update_data["email"]:
        existing_email = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != user_id)
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address already in use",
            )

    if "default_location_id" in update_data and update_data["default_location_id"] is not None:
        loc = db.query(Location).filter(Location.id == update_data["default_location_id"]).first()
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Default location not found",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user_to_out(user)


@router.post("/{user_id}/reset-password", response_model=dict)
def reset_password(
    user_id: int,
    payload: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Reset a user's password (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


@router.delete("/{user_id}", response_model=dict)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft-deactivate a user (set active=0). Cannot deactivate yourself."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.active = 0
    db.commit()
    db.refresh(user)
    return user_to_out(user)
