"""
Exports the local dev SQLite DB (backend/terminal_tracking.db) to seed.sql,
in FK-dependency order so Postgres can load it without constraint violations.

Run from anywhere: python backend/tools/export_seed.py

Binary columns (products.image_data, claim_attachments.data — product photos
/ attachment scans) are exported as NULL rather than inlined: str(bytes_value)
produces Python's repr ("b'\\x96\\xd1...'"), which is not valid SQL and was
corrupting statement parsing for the row (and sometimes nearby rows) on load.
These are cosmetic (demo photos/attachments), not core business data, so
dropping them from the seed is the simpler fix versus hex/bytea-encoding
binary literals correctly across two SQL dialects.
"""
import sqlite3
from collections import deque
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = REPO_ROOT / "backend" / "terminal_tracking.db"
OUT_PATH = REPO_ROOT / "seed.sql"

# agent_logs: an Anthropic API key ended up in an export of this table once
# and tripped GitHub's push protection — it's LLM-reasoning free text, so
# there's no reliable way to guarantee a future run won't do it again; keep
# excluding it. alerts and state_history were bundled into that same
# exclusion defensively but are plain structured business data (checked
# 2026-09-01: no secrets, just activity notes / alert messages) and are core
# functionality — Terminal Detail's state history and the Alerts page were
# silently empty on every deploy because of this. Export them.
SKIP = {"sqlite_sequence", "agent_logs"}


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    all_tables = [r[0] for r in cur.fetchall() if r[0] not in SKIP]

    # FK dependency graph + topological sort (Kahn's algorithm)
    deps = {t: set() for t in all_tables}
    for table in all_tables:
        cur.execute(f"PRAGMA foreign_key_list([{table}])")
        for fk in cur.fetchall():
            ref = fk["table"]
            if ref in deps and ref != table:
                deps[table].add(ref)

    in_degree = {t: len(deps[t]) for t in all_tables}
    queue = deque([t for t in all_tables if in_degree[t] == 0])
    ordered = []
    while queue:
        t = queue.popleft()
        ordered.append(t)
        for other in all_tables:
            if t in deps[other]:
                deps[other].discard(t)
                in_degree[other] -= 1
                if in_degree[other] == 0:
                    queue.append(other)
    for t in all_tables:  # remaining entries are FK cycles (rare) — append as-is
        if t not in ordered:
            ordered.append(t)

    lines = ["-- IMS Seed Data (FK-ordered for PostgreSQL)"]
    total = 0
    blobs_skipped = 0
    for table in ordered:
        cur2 = conn.cursor()
        cur2.execute(f"SELECT * FROM [{table}]")
        rows = cur2.fetchall()
        if not rows:
            continue
        cols = [d[0] for d in cur2.description]
        lines.append(f"\n-- {table} ({len(rows)} rows)")
        for row in rows:
            vals = []
            for v in row:
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, bytes):
                    vals.append("NULL")
                    blobs_skipped += 1
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                else:
                    escaped = str(v).replace("'", "''")
                    vals.append(f"'{escaped}'")
            col_str = ", ".join(f'"{c}"' for c in cols)
            val_str = ", ".join(vals)
            lines.append(f"INSERT INTO {table} ({col_str}) VALUES ({val_str}) ON CONFLICT DO NOTHING;")
            total += 1

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print(f"Done — {total} statements written to {OUT_PATH}")
    if blobs_skipped:
        print(f"Skipped {blobs_skipped} binary column value(s) (exported as NULL)")
    print("Table order:")
    for t in ordered:
        cur2 = conn.cursor()
        cur2.execute(f"SELECT COUNT(*) FROM [{t}]")
        c = cur2.fetchone()[0]
        if c:
            print(f"  {t}: {c} rows")
    conn.close()


if __name__ == "__main__":
    main()
