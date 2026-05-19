from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Resolve DB path relative to this file so it works regardless of cwd
DB_PATH = Path(__file__).parent / "terminal_tracking.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Read schema.sql from the project root and execute it against the SQLite DB."""
    schema_path = Path(__file__).parent.parent / "schema.sql"
    if not schema_path.exists():
        raise FileNotFoundError(f"schema.sql not found at {schema_path}")

    sql = schema_path.read_text(encoding="utf-8")

    with engine.connect() as conn:
        # Execute each statement individually (SQLite doesn't support executescript via SQLAlchemy)
        # Split on semicolons but keep only non-empty statements
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Ignore errors from already-existing objects (idempotent re-runs)
                pass
        conn.commit()
