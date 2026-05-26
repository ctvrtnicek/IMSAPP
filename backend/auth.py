import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# FastAPI dependency — current authenticated user
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    username: Optional[str] = payload.get("sub")
    if username is None:
        raise credentials_exception

    user: Optional[User] = db.query(User).filter(User.username == username).first()
    if user is None or not user.active:
        raise credentials_exception

    # Attach roles list from user_roles table (falls back to legacy users.role)
    role_rows = db.query(UserRole).filter(UserRole.user_id == user.id).all()
    if role_rows:
        user.roles_list = [r.role_code for r in role_rows]
    else:
        user.roles_list = [user.role] if user.role else []

    return user


def build_token_roles(user: User, db: Session) -> list:
    """Return the roles list for a user, used when issuing JWT."""
    role_rows = db.query(UserRole).filter(UserRole.user_id == user.id).all()
    if role_rows:
        return [r.role_code for r in role_rows]
    return [user.role] if user.role else []


ALL_ROLES = {
    "admin", "supply_planner", "demand_planner", "warehouse_user",
    "repair_centre", "supplier",
    # R3 new roles
    "inbound_specialist", "outbound_specialist", "rma_manager", "senior_management",
}
