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
    schema_path = Path(__file__).parent.parent / "schema.sql"
    if not schema_path.exists():
        return
    sql = schema_path.read_text(encoding="utf-8")
    with engine.connect() as conn:
        for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
        conn.commit()
    print("Database initialised.")
    seed_path = Path(__file__).parent.parent / "seed.sql"
    if not seed_path.exists():
        return
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        if count > 0:
            print("Seed data already present, skipping.")
            return
    seed_sql = seed_path.read_text(encoding="utf-8")
    with engine.connect() as conn:
        for stmt in [s.strip() for s in seed_sql.split(";") if s.strip() and not s.strip().upper().startswith("SET SESSION")]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass
        conn.commit()
    print("Seed data loaded.")
