"""
Regenerates schema_postgres.sql AND schema.sql by reflecting the live local
SQLite dev DB (backend/terminal_tracking.db) and compiling dialect-specific
DDL from it.

Why: hand-maintained schema.sql drifted from the real dev schema over many
migrate_vNN.py / backend/migrations/*.py patches, so both SQLite fresh-clone
bootstraps and Postgres deploys were being built from a stale/incomplete
table structure. This script makes the live SQLite DB the single source of
truth for what both should look like.

Run from the backend/ directory:
    python tools/generate_pg_schema.py

Postgres foreign keys are added via separate ALTER TABLE statements (not
inline on CREATE TABLE) because a handful of tables have FK cycles between
them (e.g. firmware <-> outbound_orders <-> products <-> return_orders),
which makes a single dependency-ordered CREATE TABLE pass impossible.
schema.sql (SQLite) keeps FKs inline instead, since SQLite doesn't support
adding a FK via ALTER TABLE at all — but it also doesn't validate that a
FK's referenced table exists at CREATE TABLE time, so creation order for
the cyclic tables doesn't matter there the way it does for Postgres.
"""
import re
from pathlib import Path

from sqlalchemy import BLOB, LargeBinary, create_engine, MetaData, text
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.schema import CreateTable, ForeignKeyConstraint

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
SQLITE_DB = BACKEND_DIR / "terminal_tracking.db"
PG_OUT_FILE = REPO_ROOT / "schema_postgres.sql"
SQLITE_OUT_FILE = REPO_ROOT / "schema.sql"

PG_HEADER = """-- ============================================================================
-- Auto-generated Postgres schema — reflected from local dev terminal_tracking.db
-- Regenerate with: backend/tools/generate_pg_schema.py
-- Do not hand-edit; fix the source SQLite DB / ORM models and regenerate instead.
-- ============================================================================

"""

SQLITE_HEADER = """-- ============================================================================
-- Auto-generated SQLite schema — reflected from local dev terminal_tracking.db
-- Regenerate with: backend/tools/generate_pg_schema.py
-- Used to bootstrap a fresh clone's local SQLite DB. Do not hand-edit; fix the
-- source SQLite DB / ORM models and regenerate instead.
-- ============================================================================

"""


def _normalize_for_postgres(meta):
    """
    Two things SQLite tolerates that reflect() carries through verbatim and
    Postgres rejects:
      - BLOB columns (products.image_data, claim_attachments.data) reflect as
        SQLAlchemy's generic BLOB type, which has no Postgres rendering
        ("type "blob" does not exist"). Postgres's binary type is BYTEA,
        which SQLAlchemy's LargeBinary maps to correctly per-dialect.
      - A DEFAULT written with double quotes (supply_flows.lead_time_unit
        DEFAULT "days") is a string literal in SQLite's lenient quoting, but
        Postgres only accepts double quotes for identifiers — it reads
        DEFAULT "days" as "default to the value of column days", failing
        with "cannot use column reference in DEFAULT expression".
    """
    for table in meta.tables.values():
        for col in table.columns:
            if isinstance(col.type, BLOB):
                col.type = LargeBinary()
            default = col.server_default
            if default is not None and hasattr(default.arg, "text"):
                m = re.fullmatch(r'"(.*)"', default.arg.text)
                if m:
                    default.arg = text("'" + m.group(1).replace("'", "''") + "'")


def generate_sqlite_schema(eng):
    meta = MetaData()
    meta.reflect(bind=eng)
    lite = sqlite.dialect()
    ddls = [
        str(CreateTable(table, if_not_exists=True).compile(dialect=lite)).strip() + ";"
        for table in meta.tables.values()
    ]
    SQLITE_OUT_FILE.write_text(SQLITE_HEADER + "\n".join(ddls) + "\n", encoding="utf-8")
    print(f"Wrote {SQLITE_OUT_FILE} — {len(ddls)} tables")


def main():
    eng = create_engine(f"sqlite:///{SQLITE_DB}")
    pg = postgresql.dialect()

    generate_sqlite_schema(eng)

    # Pass 1 — CREATE TABLE without inline FKs (avoids ordering/cycle issues)
    meta = MetaData()
    meta.reflect(bind=eng)
    _normalize_for_postgres(meta)
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

    PG_OUT_FILE.write_text(
        PG_HEADER + "\n".join(table_ddls) + "\n\n-- Foreign Keys\n" + "\n".join(fk_ddls) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {PG_OUT_FILE} — {len(table_ddls)} tables, {len(fk_ddls)} foreign keys")


if __name__ == "__main__":
    main()
