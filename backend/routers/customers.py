from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Customer, CustomerSegment, User
from schemas import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _customer_out(c: Customer, db: Session) -> dict:
    d = CustomerOut.model_validate(c).model_dump()
    if c.segment_id:
        seg = db.query(CustomerSegment).filter(CustomerSegment.id == c.segment_id).first()
        d["segment_name"] = seg.segment_name if seg else None
    return d


@router.get("", response_model=List[dict])
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all customers."""
    return [_customer_out(c, db) for c in db.query(Customer).all()]


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new customer (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    existing = db.query(Customer).filter(Customer.customer_ref == payload.customer_ref).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer ref already exists")

    data = payload.model_dump()
    # Convert enum to string value if needed
    if hasattr(data.get("customer_type"), "value"):
        data["customer_type"] = data["customer_type"].value

    customer = Customer(**data)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _customer_out(customer, db)


@router.get("/{customer_id}", response_model=dict)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single customer by ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _customer_out(customer, db)


@router.put("/{customer_id}", response_model=dict)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a customer (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return _customer_out(customer, db)


@router.delete("/{customer_id}", response_model=CustomerOut)
def deactivate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a customer by setting active=0 (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    customer.active = 0
    db.commit()
    db.refresh(customer)
    return customer
