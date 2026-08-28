import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from pathlib import Path

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

def init_database():
    import sqlparse  # pip install sqlparse

    schema_path = Path(__file__).parent.parent / "schema.sql"
    if not schema_path.exists():
        return
    sql = schema_path.read_text(encoding="utf-8")
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for stmt in sqlparse.split(sql):
            stmt = stmt.strip()
            if not stmt:
                continue
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
    print("Database initialised.")

    seed_path = Path(__file__).parent.parent / "seed.sql"
    if not seed_path.exists():
        return

    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM serial_numbers"))
        count = result.scalar()
        if count > 0:
            print("Seed data already present, skipping.")
            return

    seed_sql = seed_path.read_text(encoding="utf-8")
    stmts = [
        s.strip() for s in sqlparse.split(seed_sql)
        if s.strip() and not s.strip().startswith("--")
    ]

    ok = 0
    errors = 0
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
                ok += 1
            except Exception:
                errors += 1

    print(f"Seed data loaded. OK={ok}, errors={errors}")