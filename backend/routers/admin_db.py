"""
Admin — DB schema/seed diagnostics.

Added while chasing the Postgres deploy going out of sync with local dev data
(schema drift between the ORM models and the hand-maintained schema.sql meant
Base.metadata.create_all() created incomplete tables before schema.sql got a
chance to). Lets an admin inspect the last schema/seed run and force a clean
rebuild via the API, without needing direct DB or hosting-dashboard access.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text

from auth import get_current_user
from database import engine, init_database, last_init_summary
from models import Base, User

router = APIRouter(prefix="/api/admin/db", tags=["admin-db"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/status")
def db_status(current_user: User = Depends(require_admin)):
    """Row counts for the tables that matter most, plus the last init_database() run."""
    counts = {}
    with engine.connect() as conn:
        for t in [
            "users", "locations", "suppliers", "products", "customers",
            "purchase_orders", "outbound_orders", "serial_numbers",
            "demand_signals", "supply_flows", "agent_runs",
        ]:
            try:
                counts[t] = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            except Exception as e:
                counts[t] = f"error: {str(e).splitlines()[0][:150]}"
    return {"dialect": engine.dialect.name, "counts": counts, "last_init": last_init_summary}


@router.post("/reseed")
def reseed(
    drop_first: bool = False,
    current_user: User = Depends(require_admin),
):
    """
    Re-run schema creation + seed.sql. Idempotent (every seed INSERT uses
    ON CONFLICT DO NOTHING) — safe to call any time.

    drop_first=true additionally wipes every table first for a fully clean
    rebuild — use when a table already exists with an incomplete/stale column
    set (CREATE TABLE IF NOT EXISTS is a no-op against it otherwise). Uses
    DROP SCHEMA ... CASCADE on Postgres since a handful of tables have
    circular FK references that Base.metadata.drop_all() can't order safely.
    """
    if drop_first:
        if engine.dialect.name == "postgresql":
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                conn.execute(text("DROP SCHEMA public CASCADE"))
                conn.execute(text("CREATE SCHEMA public"))
        else:
            Base.metadata.drop_all(bind=engine)
    summary = init_database()
    Base.metadata.create_all(bind=engine)  # safety net for any ORM-only tables
    return summary
