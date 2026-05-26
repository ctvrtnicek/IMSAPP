from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    build_token_roles,
    get_current_user,
    verify_password,
)
from database import get_db
from models import User
from schemas import Token, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with username + password, return a JWT."""
    user: User | None = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    roles = build_token_roles(user, db)
    # Primary role = first in list (for backward compat) or legacy users.role
    primary_role = user.role or (roles[0] if roles else "")
    access_token = create_access_token(data={"sub": user.username, "roles": roles})

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=primary_role,
        username=user.username,
        roles=roles,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
