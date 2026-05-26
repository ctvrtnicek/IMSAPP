from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from auth import get_current_user
from database import get_db
from models import (
    Product, User, ProductPricing, ProductAlternative, ProductBomComponent, Firmware
)
from schemas import ProductCreate, ProductOut, ProductUpdate


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3B schemas for sub-resources
# ─────────────────────────────────────────────────────────────────────────────

class PricingOut(BaseModel):
    id: int
    product_id: int
    region_id: Optional[int] = None
    country_id: Optional[int] = None
    sell_price: Optional[float] = None
    rental_price_month: Optional[float] = None
    currency: str
    effective_date: Optional[str] = None
    model_config = {"from_attributes": True}


class PricingCreate(BaseModel):
    region_id: Optional[int] = None
    country_id: Optional[int] = None
    sell_price: Optional[float] = None
    rental_price_month: Optional[float] = None
    currency: str = "EUR"
    effective_date: Optional[str] = None


class AlternativeOut(BaseModel):
    id: int
    product_id: int
    alternative_product_id: int
    alternative_code: Optional[str] = None
    alternative_name: Optional[str] = None
    sequence: int
    model_config = {"from_attributes": True}


class AlternativeCreate(BaseModel):
    alternative_product_id: int
    sequence: int = 1


class BomComponentOut(BaseModel):
    id: int
    parent_product_id: int
    component_product_id: int
    component_code: Optional[str] = None
    component_name: Optional[str] = None
    quantity: int = 1
    assembly_leadtime_value: Optional[int] = None
    assembly_leadtime_unit: Optional[str] = None
    model_config = {"from_attributes": True}


class BomComponentCreate(BaseModel):
    component_product_id: int
    quantity: int = 1
    assembly_leadtime_value: Optional[int] = None
    assembly_leadtime_unit: Optional[str] = None


class BomComponentUpdate(BaseModel):
    quantity: Optional[int] = None
    assembly_leadtime_value: Optional[int] = None
    assembly_leadtime_unit: Optional[str] = None

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=List[ProductOut])
def list_products(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return products. Pass ?include_inactive=true to include inactive."""
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.active == 1)
    return query.all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new product (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    existing = db.query(Product).filter(Product.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product code already exists")

    data = payload.model_dump()
    # Convert enum values to their string values
    data["product_type"] = data["product_type"].value if hasattr(data["product_type"], "value") else data["product_type"]
    data["product_category"] = data["product_category"].value if hasattr(data["product_category"], "value") else data["product_category"]

    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a product (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum to string value if needed
        if hasattr(value, "value"):
            value = value.value
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", response_model=ProductOut)
def deactivate_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a product by setting active=0 (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.active = 0
    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Product image upload / serve
# ---------------------------------------------------------------------------

@router.post("/{product_id}/image", status_code=200)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.image_data = await file.read()
    product.image_content_type = file.content_type or "application/octet-stream"
    db.commit()
    return {"ok": True}


@router.get("/{product_id}/image")
def get_product_image(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # noqa: allow token via query param too
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.image_data:
        raise HTTPException(status_code=404, detail="No image")
    return Response(
        content=product.image_data,
        media_type=product.image_content_type or "image/jpeg",
        headers={"Cache-Control": "max-age=3600"},
    )


@router.delete("/{product_id}/image", status_code=200)
def delete_product_image(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.image_data = None
    product.image_content_type = None
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3B — Pricing sub-resource
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{product_id}/pricing", response_model=List[PricingOut])
def list_pricing(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ProductPricing).filter(ProductPricing.product_id == product_id).all()


@router.post("/{product_id}/pricing", response_model=PricingOut, status_code=201)
def add_pricing(product_id: int, payload: PricingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(404, "Product not found")
    row = ProductPricing(product_id=product_id, **payload.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.put("/{product_id}/pricing/{pricing_id}", response_model=PricingOut)
def update_pricing(product_id: int, pricing_id: int, payload: PricingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductPricing).filter(ProductPricing.id == pricing_id, ProductPricing.product_id == product_id).first()
    if not row: raise HTTPException(404, "Pricing row not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    return row


@router.delete("/{product_id}/pricing/{pricing_id}", status_code=204)
def delete_pricing(product_id: int, pricing_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductPricing).filter(ProductPricing.id == pricing_id, ProductPricing.product_id == product_id).first()
    if not row: raise HTTPException(404, "Pricing row not found")
    db.delete(row); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3B — Alternatives sub-resource
# ─────────────────────────────────────────────────────────────────────────────

def _alt_out(a: ProductAlternative) -> AlternativeOut:
    return AlternativeOut(
        id=a.id, product_id=a.product_id, alternative_product_id=a.alternative_product_id,
        alternative_code=a.alternative.code if a.alternative else None,
        alternative_name=a.alternative.name if a.alternative else None,
        sequence=a.sequence,
    )


@router.get("/{product_id}/alternatives", response_model=List[AlternativeOut])
def list_alternatives(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ProductAlternative).filter(ProductAlternative.product_id == product_id).order_by(ProductAlternative.sequence).all()
    return [_alt_out(r) for r in rows]


@router.post("/{product_id}/alternatives", response_model=AlternativeOut, status_code=201)
def add_alternative(product_id: int, payload: AlternativeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(404, "Product not found")
    if not db.query(Product).filter(Product.id == payload.alternative_product_id).first():
        raise HTTPException(404, "Alternative product not found")
    row = ProductAlternative(product_id=product_id, **payload.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return _alt_out(row)


@router.put("/{product_id}/alternatives/{alt_id}", response_model=AlternativeOut)
def update_alternative(product_id: int, alt_id: int, payload: AlternativeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductAlternative).filter(ProductAlternative.id == alt_id, ProductAlternative.product_id == product_id).first()
    if not row: raise HTTPException(404, "Alternative not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    return _alt_out(row)


@router.delete("/{product_id}/alternatives/{alt_id}", status_code=204)
def delete_alternative(product_id: int, alt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductAlternative).filter(ProductAlternative.id == alt_id, ProductAlternative.product_id == product_id).first()
    if not row: raise HTTPException(404, "Alternative not found")
    db.delete(row); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3B — BOM Components sub-resource
# ─────────────────────────────────────────────────────────────────────────────

def _bom_out(b: ProductBomComponent) -> BomComponentOut:
    return BomComponentOut(
        id=b.id, parent_product_id=b.parent_product_id,
        component_product_id=b.component_product_id,
        component_code=b.component.code if b.component else None,
        component_name=b.component.name if b.component else None,
        quantity=b.quantity or 1,
        assembly_leadtime_value=b.assembly_leadtime_value,
        assembly_leadtime_unit=b.assembly_leadtime_unit,
    )


@router.get("/{product_id}/bom", response_model=List[BomComponentOut])
def list_bom(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ProductBomComponent).filter(ProductBomComponent.parent_product_id == product_id).all()
    return [_bom_out(r) for r in rows]


@router.post("/{product_id}/bom", response_model=BomComponentOut, status_code=201)
def add_bom_component(product_id: int, payload: BomComponentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(404, "Product not found")
    if not db.query(Product).filter(Product.id == payload.component_product_id).first():
        raise HTTPException(404, "Component product not found")
    row = ProductBomComponent(parent_product_id=product_id, **payload.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return _bom_out(row)


@router.put("/{product_id}/bom/{bom_id}", response_model=BomComponentOut)
def update_bom_component(product_id: int, bom_id: int, payload: BomComponentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductBomComponent).filter(ProductBomComponent.id == bom_id, ProductBomComponent.parent_product_id == product_id).first()
    if not row: raise HTTPException(404, "BOM component not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    return _bom_out(row)


@router.delete("/{product_id}/bom/{bom_id}", status_code=204)
def delete_bom_component(product_id: int, bom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    row = db.query(ProductBomComponent).filter(ProductBomComponent.id == bom_id, ProductBomComponent.parent_product_id == product_id).first()
    if not row: raise HTTPException(404, "BOM component not found")
    db.delete(row); db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3B — Set latest firmware on product
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{product_id}/latest-firmware", response_model=ProductOut)
def set_latest_firmware(product_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(403, "Admin only")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product: raise HTTPException(404, "Product not found")
    fw_id = payload.get("firmware_id")
    if fw_id and not db.query(Firmware).filter(Firmware.id == fw_id).first():
        raise HTTPException(404, "Firmware not found")
    product.latest_firmware_id = fw_id
    db.commit(); db.refresh(product)
    return product
