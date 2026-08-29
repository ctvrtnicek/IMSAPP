import os
import threading
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./terminal_tracking.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Progress/result of the most recent init_database() run — read back via
# GET /api/admin/db/status so seed problems (and whether a run is still in
# flight) are visible without direct access to the hosting provider's log
# console. Render's own proxy times out long HTTP requests well before ~1000
# statements can run one-by-one over the network, so init_database() is meant
# to be kicked off as a background task (see routers/admin_db.py) and polled.
init_state = {"running": False, "phase": None, "processed": 0, "total": 0}
last_init_summary = {}
_init_lock = threading.Lock()


def _is_benign(msg: str) -> bool:
    """Errors we expect on a rerun (table/constraint already there, row already seeded)."""
    m = msg.lower()
    return "already exists" in m or "duplicate" in m


def _run_statements(conn, statements, label, batch_size=200):
    """
    Executes statements in batches (one network round-trip per batch) instead
    of one-by-one — with ~1000 total statements, per-statement round-trips to
    a free-tier Postgres instance is what was blowing past Render's request
    timeout. A batch runs as one implicit transaction, so if any statement in
    it fails, the whole batch is retried one statement at a time to isolate
    exactly which one(s) failed without losing the others.
    """
    ok, errors = 0, []
    n = len(statements)
    i = 0
    while i < n:
        batch = statements[i : i + batch_size]
        try:
            conn.execute(text(";\n".join(batch) + ";"))
            ok += len(batch)
        except Exception:
            for stmt in batch:
                try:
                    conn.execute(text(stmt))
                    ok += 1
                except Exception as e:
                    msg = str(e).splitlines()[0][:300]
                    if not _is_benign(msg):
                        errors.append({"statement": stmt[:200], "error": msg})
        i += batch_size
        init_state["processed"] = min(i, n)
        init_state["total"] = n
        init_state["phase"] = label

    print(f"[init_database] {label}: ok={ok} errors={len(errors)}")
    for e in errors[:10]:
        print(f"[init_database]   {label} error: {e['error']} | {e['statement']}")
    return ok, errors


def init_database():
    if not _init_lock.acquire(blocking=False):
        print("[init_database] already running, skipping overlapping call")
        return {"skipped": "already running"}

    try:
        import sqlparse  # pip install sqlparse

        init_state.update(running=True, phase="schema", processed=0, total=0)

        dialect = engine.dialect.name  # 'postgresql' or 'sqlite'
        schema_file = "schema_postgres.sql" if dialect == "postgresql" else "schema.sql"
        schema_path = Path(__file__).parent.parent / schema_file

        summary = {"dialect": dialect, "schema_file": schema_file}

        if schema_path.exists():
            sql = schema_path.read_text(encoding="utf-8")
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                ok, errors = _run_statements(conn, sqlparse.split(sql), "schema")
            summary["schema"] = {"ok": ok, "errors": errors}
        print("Database schema ensured.")

        seed_path = Path(__file__).parent.parent / "seed.sql"
        if seed_path.exists():
            seed_sql = seed_path.read_text(encoding="utf-8")
            stmts = [s.strip() for s in sqlparse.split(seed_sql) if s.strip() and not s.strip().startswith("--")]
            # Every INSERT in seed.sql uses ON CONFLICT DO NOTHING, so re-running the
            # full seed is safe/idempotent — it only fills in rows that are actually
            # missing. Deliberately no "already seeded, skip" guard: a guard keyed on
            # one table's row count can get stuck permanently skipping once that
            # table has *any* rows, even if seeding failed for everything else on
            # the first (broken) attempt.
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                ok, errors = _run_statements(conn, stmts, "seed")
            summary["seed"] = {"ok": ok, "errors": errors}
            print(f"Seed data loaded. OK={ok}, errors={len(errors)}")

        global last_init_summary
        last_init_summary = summary
        return summary
    finally:
        init_state["running"] = False
        _init_lock.release()
