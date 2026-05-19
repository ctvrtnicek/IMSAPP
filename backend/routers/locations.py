from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Location, LocationType, User
from schemas import (
    LocationCreate,
    LocationOut,
    LocationTypeCreate,
    LocationTypeOut,
    LocationUpdate,
)

# ---------------------------------------------------------------------------
# Location Types router
# ---------------------------------------------------------------------------
location_types_router = APIRouter(prefix="/api/location-types", tags=["location-types"])


@location_types_router.get("", response_model=List[LocationTypeOut])
def list_location_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all active location types."""
    return db.query(LocationType).filter(LocationType.active == 1).all()


@location_types_router.post("", response_model=LocationTypeOut, status_code=status.HTTP_201_CREATED)
def create_location_type(
    payload: LocationTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new location type (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    existing = db.query(LocationType).filter(LocationType.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Location type already exists")

    lt = LocationType(name=payload.name)
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt


# ---------------------------------------------------------------------------
# Locations router
# ---------------------------------------------------------------------------
locations_router = APIRouter(prefix="/api/locations", tags=["locations"])


def _to_location_out(loc: Location) -> LocationOut:
    """Map ORM Location to LocationOut, populating location_type_name."""
    return LocationOut(
        id=loc.id,
        code=loc.code,
        name=loc.name,
        location_type_id=loc.location_type_id,
        country=loc.country,
        city=loc.city,
        reporting_currency=loc.reporting_currency,
        active=loc.active,
        location_type_name=loc.location_type.name if loc.location_type else None,
    )


@locations_router.get("", response_model=List[LocationOut])
def list_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all locations with their location type names."""
    locations = db.query(Location).all()
    return [_to_location_out(loc) for loc in locations]


@locations_router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new location (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    # Verify location type exists
    lt = db.query(LocationType).filter(LocationType.id == payload.location_type_id).first()
    if not lt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location type not found")

    existing = db.query(Location).filter(Location.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Location code already exists")

    loc = Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return _to_location_out(loc)


@locations_router.get("/{location_id}", response_model=LocationOut)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single location by ID."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return _to_location_out(loc)


@locations_router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a location (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(loc, field, value)

    db.commit()
    db.refresh(loc)
    return _to_location_out(loc)


@locations_router.delete("/{location_id}", response_model=LocationOut)
def deactivate_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a location by setting active=0 (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    loc.active = 0
    db.commit()
    db.refresh(loc)
    return _to_location_out(loc)
