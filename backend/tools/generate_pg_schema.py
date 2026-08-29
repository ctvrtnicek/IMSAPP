"""
Regenerates schema_postgres.sql by reflecting the live local SQLite dev DB
(backend/terminal_tracking.db) and compiling Postgres-dialect DDL from it.

Why: hand-maintained schema.sql drifted from the real dev schema over many
migrate_vNN.py / backend/migrations/*.py patches, so Postgres deploys were
being built from a stale/incomplete table structure. This script makes the
live SQLite DB the single source of truth for what Postgres should look like.

Run from the backend/ directory:
    python tools/generate_pg_schema.py

Foreign keys are added via separate ALTER TABLE statements (not inline on
CREATE TABLE) because a handful of tables have FK cycles between them
(e.g. firmware <-> outbound_orders <-> products <-> return_orders), which
makes a single dependency-ordered CREATE TABLE pass impossible.
"""
from pathlib import Path

from sqlalchemy import create_engine, MetaData
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable, ForeignKeyConstraint

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
SQLITE_DB = BACKEND_DIR / "terminal_tracking.db"
OUT_FILE = REPO_ROOT / "schema_postgres.sql"

HEADER = """-- ============================================================================
-- Auto-generated Postgres schema — reflected from local dev terminal_tracking.db
-- Regenerate with: backend/tools/generate_pg_schema.py
-- Do not hand-edit; fix the source SQLite DB / ORM models and regenerate instead.
-- ============================================================================

"""


def main():
    eng = create_engine(f"sqlite:///{SQLITE_DB}")
    pg = postgresql.dialect()

    # Pass 1 — CREATE TABLE without inline FKs (avoids ordering/cycle issues)
    meta = MetaData()
    meta.reflect(bind=eng)
    table_ddls = []
    for table in meta.tables.values():
        for fk in [c for c in table.constraints if isinstance(c, ForeignKeyConstraint)]:
            table.constraints.discard(fk)
        for col in table.columns:
            col.foreign_keys = set()
        ddl = str(CreateTable(table, if_not_exists=True).compile(dialect=pg)).strip()
        table_ddls.append(ddl + ";")

    # Pass 2 — re-reflect fresh (pass 1 mutated its metadata) to get FK constraints,
    # emitted as separate ALTER TABLE statements.
    meta2 = MetaData()
    meta2.reflect(bind=eng)
    fk_ddls = []
    seen = set()
    for table in sorted(meta2.tables.values(), key=lambda t: t.name):
        idx = 0
        for fk in [c for c in table.constraints if isinstance(c, ForeignKeyConstraint)]:
            cols = [c.name for c in fk.columns]
            refcols = [e.column.name for e in fk.elements]
            reftable = fk.elements[0].column.table.name
            idx += 1
            name = f"fk_{table.name}_{idx}"
            while name in seen:
                idx += 1
                name = f"fk_{table.name}_{idx}"
            seen.add(name)
            fk_ddls.append(
                f"ALTER TABLE {table.name} ADD CONSTRAINT {name} "
                f"FOREIGN KEY ({', '.join(cols)}) REFERENCES {reftable} ({', '.join(refcols)});"
            )

    OUT_FILE.write_text(
        HEADER + "\n".join(table_ddls) + "\n\n-- Foreign Keys\n" + "\n".join(fk_ddls) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_FILE} — {len(table_ddls)} tables, {len(fk_ddls)} foreign keys")


if __name__ == "__main__":
    main()
