import os
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

def init_database():
    from pathlib import Path
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
