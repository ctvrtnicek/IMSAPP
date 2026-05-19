"""
business_calendars.py — CRUD router for BusinessCalendar master data.

Prefix: /api/business-calendars
Write endpoints require admin role.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import BusinessCalendar, BusinessCalendarHoliday, Location, Supplier, User

router = APIRouter(prefix="/api/business-calendars", tags=["business-calendars"])


def _cal_to_out(cal: BusinessCalendar, db: Session) -> dict:
    supplier_label = None
    if cal.supplier_id:
        sup = db.query(Supplier).filter(Supplier.id == cal.supplier_id).first()
        if sup:
            supplier_label = f"{sup.code} — {sup.name}"

    return {
        "id": cal.id,
        "entity_type": cal.entity_type,
        "location_id": cal.location_id,
        "location_label": (f"{cal.location.code} — {cal.location.name}") if cal.location else None,
        "supplier_id": cal.supplier_id,
        "supplier_label": supplier_label,
        "timezone": cal.timezone,
        "working_days": cal.working_days,
        "work_hours_start": cal.work_hours_start,
        "work_hours_end": cal.work_hours_end,
        "holidays": [
            {
                "id": h.id,
                "holiday_date": h.holiday_date,
                "description": h.description,
            }
            for h in sorted(cal.holidays, key=lambda x: x.holiday_date)
        ],
    }


@router.get("")
def list_calendars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cals = db.query(BusinessCalendar).order_by(BusinessCalendar.entity_type, BusinessCalendar.id).all()
    return [_cal_to_out(c, db) for c in cals]


@router.get("/{cal_id}")
def get_calendar(
    cal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cal = db.query(BusinessCalendar).filter(BusinessCalendar.id == cal_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    return _cal_to_out(cal, db)


@router.post("", status_code=201)
def create_calendar(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    cal = BusinessCalendar(
        entity_type=payload["entity_type"],
        location_id=payload.get("location_id"),
        supplier_id=payload.get("supplier_id"),
        timezone=payload.get("timezone", "UTC"),
        working_days=payload.get("working_days", "Mon,Tue,Wed,Thu,Fri"),
        work_hours_start=payload.get("work_hours_start", "08:00"),
        work_hours_end=payload.get("work_hours_end", "17:00"),
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)

    for h in payload.get("holidays", []):
        db.add(BusinessCalendarHoliday(
            calendar_id=cal.id,
            holiday_date=h["holiday_date"],
            description=h.get("description"),
        ))
    db.commit()
    db.refresh(cal)
    return _cal_to_out(cal, db)


@router.put("/{cal_id}")
def update_calendar(
    cal_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    cal = db.query(BusinessCalendar).filter(BusinessCalendar.id == cal_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")

    cal.entity_type = payload.get("entity_type", cal.entity_type)
    cal.location_id = payload.get("location_id", cal.location_id)
    cal.supplier_id = payload.get("supplier_id", cal.supplier_id)
    cal.timezone = payload.get("timezone", cal.timezone)
    cal.working_days = payload.get("working_days", cal.working_days)
    cal.work_hours_start = payload.get("work_hours_start", cal.work_hours_start)
    cal.work_hours_end = payload.get("work_hours_end", cal.work_hours_end)

    # Replace holidays
    if "holidays" in payload:
        db.query(BusinessCalendarHoliday).filter(
            BusinessCalendarHoliday.calendar_id == cal_id
        ).delete()
        for h in payload["holidays"]:
            db.add(BusinessCalendarHoliday(
                calendar_id=cal_id,
                holiday_date=h["holiday_date"],
                description=h.get("description"),
            ))

    db.commit()
    db.refresh(cal)
    return _cal_to_out(cal, db)


@router.delete("/{cal_id}", status_code=204)
def delete_calendar(
    cal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    cal = db.query(BusinessCalendar).filter(BusinessCalendar.id == cal_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")

    db.delete(cal)
    db.commit()
