"""
claims.py — Claims Management router (Phase 2G).
Prefix: /api/claims
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Claim, ClaimAttachment, ClaimType, OrderNumbering, OutboundOrder, PurchaseOrder, SerialNumber, User

router = APIRouter(prefix="/api/claims", tags=["claims"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ClaimTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    raised_against: str = "Supplier"

class ClaimTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    raised_against: Optional[str] = None
    active: Optional[int] = None

class ClaimCreate(BaseModel):
    po_id: Optional[int] = None
    outbound_order_id: Optional[int] = None
    serial_id: Optional[int] = None
    claim_type_id: int
    raised_against: str
    urgency: Optional[str] = "Normal"
    description: Optional[str] = None

class ClaimUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_claim_number(db: Session) -> str:
    row = db.query(OrderNumbering).filter(OrderNumbering.order_type == "Claim").with_for_update().first()
    if not row:
        return "CL000001"
    row.current_sequence += 1
    db.flush()
    return f"{row.prefix}{str(row.current_sequence).zfill(row.padding_length)}"


def claim_type_to_out(ct: ClaimType) -> dict:
    return {
        "id": ct.id,
        "name": ct.name,
        "description": ct.description,
        "raised_against": ct.raised_against,
        "active": ct.active,
    }


def claim_to_out(c: Claim) -> dict:
    return {
        "id": c.id,
        "claim_number": c.claim_number,
        "po_id": c.po_id,
        "po_number": c.po.po_number if c.po else None,
        "outbound_order_id": c.outbound_order_id,
        "outbound_order_number": c.outbound_order.order_number if c.outbound_order else None,
        "serial_id": c.serial_id,
        "serial_number": c.serial.serial_number if c.serial else None,
        "claim_type_id": c.claim_type_id,
        "claim_type_name": c.claim_type.name if c.claim_type else None,
        "raised_against": c.raised_against,
        "status": c.status,
        "urgency": c.urgency if c.urgency else "Normal",
        "description": c.description,
        "resolution_notes": c.resolution_notes,
        "created_by_username": c.created_by.username if c.created_by else None,
        "created_at": str(c.created_at) if c.created_at else None,
        "updated_at": str(c.updated_at) if c.updated_at else None,
    }


# ===========================================================================
# Claim Types (admin)
# ===========================================================================

@router.get("/types")
def list_claim_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [claim_type_to_out(ct) for ct in db.query(ClaimType).order_by(ClaimType.id).all()]


@router.post("/types", status_code=status.HTTP_201_CREATED)
def create_claim_type(
    payload: ClaimTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ct = ClaimType(**payload.model_dump())
    db.add(ct)
    db.commit()
    db.refresh(ct)
    return claim_type_to_out(ct)


@router.put("/types/{ct_id}")
def update_claim_type(
    ct_id: int,
    payload: ClaimTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ct = db.query(ClaimType).filter(ClaimType.id == ct_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Claim type not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ct, k, v)
    db.commit()
    db.refresh(ct)
    return claim_type_to_out(ct)


@router.delete("/types/{ct_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim_type(
    ct_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ct = db.query(ClaimType).filter(ClaimType.id == ct_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Claim type not found")
    db.delete(ct)
    db.commit()


# ===========================================================================
# Claims
# ===========================================================================

@router.get("")
def list_claims(
    po_id: Optional[int] = Query(None),
    outbound_order_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    raised_against: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Claim)
    if po_id:
        q = q.filter(Claim.po_id == po_id)
    if outbound_order_id:
        q = q.filter(Claim.outbound_order_id == outbound_order_id)
    if status_filter:
        q = q.filter(Claim.status == status_filter)
    if raised_against:
        q = q.filter(Claim.raised_against == raised_against)
    return [claim_to_out(c) for c in q.order_by(Claim.id.desc()).all()]


@router.get("/{claim_id}")
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Claim).filter(Claim.id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim_to_out(c)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "supply_planner", "warehouse_user"):
        raise HTTPException(status_code=403, detail="Access denied")
    if not payload.po_id and not payload.serial_id and not payload.outbound_order_id:
        raise HTTPException(status_code=400, detail="Either po_id, outbound_order_id, or serial_id is required")
    ct = db.query(ClaimType).filter(ClaimType.id == payload.claim_type_id).first()
    if not ct:
        raise HTTPException(status_code=400, detail="Claim type not found")
    c = Claim(
        claim_number=generate_claim_number(db),
        created_by_user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return claim_to_out(c)


@router.put("/{claim_id}")
def update_claim(
    claim_id: int,
    payload: ClaimUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "supply_planner"):
        raise HTTPException(status_code=403, detail="supply_planner or admin only")
    c = db.query(Claim).filter(Claim.id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return claim_to_out(c)


# ===========================================================================
# Claim Attachments
# ===========================================================================

@router.post("/{claim_id}/attachments")
async def upload_attachment(
    claim_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Claim).filter(Claim.id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    data = await file.read()
    att = ClaimAttachment(
        claim_id=claim_id,
        filename=file.filename,
        content_type=file.content_type,
        data=data,
        uploaded_by_user_id=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return {"id": att.id, "filename": att.filename, "content_type": att.content_type}


@router.get("/{claim_id}/attachments")
def list_attachments(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atts = db.query(ClaimAttachment).filter(ClaimAttachment.claim_id == claim_id).all()
    return [
        {
            "id": a.id,
            "filename": a.filename,
            "content_type": a.content_type,
            "uploaded_at": a.uploaded_at.isoformat() if a.uploaded_at else None,
        }
        for a in atts
    ]


@router.get("/{claim_id}/attachments/{att_id}")
def download_attachment(
    claim_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(ClaimAttachment).filter(
        ClaimAttachment.id == att_id, ClaimAttachment.claim_id == claim_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return Response(
        content=att.data,
        media_type=att.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )


@router.delete("/{claim_id}/attachments/{att_id}")
def delete_attachment(
    claim_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(ClaimAttachment).filter(
        ClaimAttachment.id == att_id, ClaimAttachment.claim_id == claim_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(att)
    db.commit()
    return {"ok": True}
