from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Product, User
from schemas import ProductCreate, ProductOut, ProductUpdate

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
