"""
Phase 3B — Firmware router
Firmware master CRUD + file upload
"""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from auth import get_current_user
from database import get_db
from models import Firmware, User

router = APIRouter(prefix="/api/firmware", tags=["firmware"])

FIRMWARE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firmware_files")
os.makedirs(FIRMWARE_DIR, exist_ok=True)


def _require_admin(user: User):
    roles = getattr(user, "roles_list", [user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin only")


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class FirmwareOut(BaseModel):
    id: int
    firmware_name: str
    version: str
    release_number: Optional[str] = None
    release_date: Optional[str] = None
    release_hour: Optional[str] = None
    key_used: Optional[str] = None
    file_path: Optional[str] = None
    has_file: bool = False
    product_id: Optional[int] = None
    product_code: Optional[str] = None
    active: int = 1
    created_at: Optional[str] = None
    model_config = {"from_attributes": True}


class FirmwareCreate(BaseModel):
    firmware_name: str
    version: str
    release_number: Optional[str] = None
    release_date: Optional[str] = None
    release_hour: Optional[str] = None
    key_used: Optional[str] = None
    product_id: Optional[int] = None
    active: int = 1


class FirmwareUpdate(BaseModel):
    firmware_name: Optional[str] = None
    version: Optional[str] = None
    release_number: Optional[str] = None
    release_date: Optional[str] = None
    release_hour: Optional[str] = None
    key_used: Optional[str] = None
    product_id: Optional[int] = None
    active: Optional[int] = None


def _fw_out(fw: Firmware) -> FirmwareOut:
    return FirmwareOut(
        id=fw.id, firmware_name=fw.firmware_name, version=fw.version,
        release_number=fw.release_number, release_date=fw.release_date,
        release_hour=fw.release_hour, key_used=fw.key_used,
        file_path=fw.file_path,
        has_file=bool(fw.file_path and os.path.exists(fw.file_path)),
        product_id=fw.product_id,
        product_code=fw.product.code if fw.product else None,
        active=fw.active if fw.active is not None else 1,
        created_at=str(fw.created_at) if fw.created_at else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[FirmwareOut])
def list_firmware(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [_fw_out(fw) for fw in db.query(Firmware).order_by(Firmware.id.desc()).all()]


@router.get("/{firmware_id}", response_model=FirmwareOut)
def get_firmware(firmware_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fw = db.query(Firmware).filter(Firmware.id == firmware_id).first()
    if not fw: raise HTTPException(404, "Firmware not found")
    return _fw_out(fw)


@router.post("", response_model=FirmwareOut, status_code=201)
def create_firmware(payload: FirmwareCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    fw = Firmware(**payload.model_dump())
    db.add(fw); db.commit(); db.refresh(fw)
    return _fw_out(fw)


@router.put("/{firmware_id}", response_model=FirmwareOut)
def update_firmware(firmware_id: int, payload: FirmwareUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    fw = db.query(Firmware).filter(Firmware.id == firmware_id).first()
    if not fw: raise HTTPException(404, "Firmware not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(fw, k, v)
    db.commit(); db.refresh(fw)
    return _fw_out(fw)


@router.delete("/{firmware_id}", status_code=204)
def delete_firmware(firmware_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    fw = db.query(Firmware).filter(Firmware.id == firmware_id).first()
    if not fw: raise HTTPException(404, "Firmware not found")
    if fw.file_path and os.path.exists(fw.file_path):
        os.remove(fw.file_path)
    db.delete(fw); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# File upload
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{firmware_id}/upload", response_model=FirmwareOut)
async def upload_firmware_file(
    firmware_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    fw = db.query(Firmware).filter(Firmware.id == firmware_id).first()
    if not fw: raise HTTPException(404, "Firmware not found")

    # Remove old file if present
    if fw.file_path and os.path.exists(fw.file_path):
        os.remove(fw.file_path)

    safe_name = f"{firmware_id}_{file.filename.replace(' ', '_')}"
    dest = os.path.join(FIRMWARE_DIR, safe_name)
    with open(dest, "wb") as f_out:
        shutil.copyfileobj(file.file, f_out)

    fw.file_path = dest
    db.commit(); db.refresh(fw)
    return _fw_out(fw)
