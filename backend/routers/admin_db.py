"""
Admin — DB schema/seed diagnostics.

Added while chasing the Postgres deploy going out of sync with local dev data
(schema drift between the ORM models and the hand-maintained schema.sql meant
Base.metadata.create_all() created incomplete tables before schema.sql got a
chance to). Lets an admin inspect the last schema/seed run and force a clean
rebuild via the API, without needing direct DB or hosting-dashboard access.

/reseed kicks the actual work off in a background thread and returns
immediately — a full schema+seed pass is ~1000 statements against Postgres,
which comfortably exceeds Render's front-door proxy request timeout if run
synchronously in the request handler. Poll /status for progress/results.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import text

import database
from auth import get_current_user
from models import Base, User

router = APIRouter(prefix="/api/admin/db", tags=["admin-db"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    roles = getattr(current_user, "roles_list", [current_user.role])
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/status")
def db_status(current_user: User = Depends(require_admin)):
    """Row counts for the tables that matter most, plus the last/in-flight init_database() run."""
    counts = {}
    with database.engine.connect() as conn:
        for t in [
            "users", "locations", "suppliers", "products", "customers",
            "purchase_orders", "outbound_orders", "serial_numbers",
            "demand_signals", "supply_flows", "agent_runs",
        ]:
            try:
                counts[t] = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            except Exception as e:
                counts[t] = f"error: {str(e).splitlines()[0][:150]}"
    return {
        "dialect": database.engine.dialect.name,
        "counts": counts,
        "init_state": database.init_state,
        "last_init": database.last_init_summary,
    }


def _do_reseed(drop_first: bool):
    if drop_first:
        if database.engine.dialect.name == "postgresql":
            with database.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                conn.execute(text("DROP SCHEMA public CASCADE"))
                conn.execute(text("CREATE SCHEMA public"))
        else:
            Base.metadata.drop_all(bind=database.engine)
    database.init_database()
    Base.metadata.create_all(bind=database.engine)  # safety net for any ORM-only tables


@router.post("/reseed")
def reseed(
    background_tasks: BackgroundTasks,
    drop_first: bool = False,
    current_user: User = Depends(require_admin),
):
    """
    Re-run schema creation + seed.sql in the background. Idempotent (every
    seed INSERT uses ON CONFLICT DO NOTHING) — safe to call any time.

    drop_first=true additionally wipes every table first for a fully clean
    rebuild — use when a table already exists with an incomplete/stale column
    set (CREATE TABLE IF NOT EXISTS is a no-op against it otherwise). Uses
    DROP SCHEMA ... CASCADE on Postgres since a handful of tables have
    circular FK references that Base.metadata.drop_all() can't order safely.
    """
    if database.init_state["running"]:
        return {"status": "already running", "init_state": database.init_state}
    background_tasks.add_task(_do_reseed, drop_first)
    return {"status": "started", "drop_first": drop_first, "poll": "GET /api/admin/db/status"}
