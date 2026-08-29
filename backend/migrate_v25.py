"""
Migration v25 — B-01 + B-02 fixes
  • supply_flows: make from/to_location_id nullable; add from/to_supplier_id
  • locations: add country_code (soft FK to countries.country_code)
  • suppliers: add country_code
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")


def col_exists(cursor, table, col):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cursor.fetchall())


def run():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    # ── supply_flows ─────────────────────────────────────────────────────────
    # SQLite cannot ALTER COLUMN to drop NOT NULL, so we recreate the table.
    cur.execute("PRAGMA table_info(supply_flows)")
    cols = {r[1]: r for r in cur.fetchall()}

    # Only rebuild if from_location_id is still NOT NULL
    from_loc_notnull = cols.get("from_location_id", (None,)*4)[3]  # notNull flag is index 3
    has_from_supplier = "from_supplier_id" in cols

    if from_loc_notnull or not has_from_supplier:
        print("Rebuilding supply_flows table...")
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS supply_flows_new (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                network_version_id INTEGER NOT NULL REFERENCES network_versions(id),
                from_location_id   INTEGER REFERENCES locations(id),
                from_supplier_id   INTEGER REFERENCES suppliers(id),
                to_location_id     INTEGER REFERENCES locations(id),
                to_supplier_id     INTEGER REFERENCES suppliers(id),
                flow_type          TEXT NOT NULL,
                active             INTEGER NOT NULL DEFAULT 1
            );
            INSERT INTO supply_flows_new
                (id, network_version_id, from_location_id, to_location_id, flow_type, active)
            SELECT id, network_version_id, from_location_id, to_location_id, flow_type, active
            FROM supply_flows;
            DROP TABLE supply_flows;
            ALTER TABLE supply_flows_new RENAME TO supply_flows;
        """)
        print("  supply_flows rebuilt.")
    else:
        print("  supply_flows already up to date.")

    # ── flow_constraints: re-create FK after table rename ────────────────────
    # SQLite cascades are only enforced if PRAGMA foreign_keys=ON at runtime,
    # so the FK reference in flow_constraints still points to supply_flows by name — OK.

    # ── locations: add country_code ──────────────────────────────────────────
    if not col_exists(cur, "locations", "country_code"):
        cur.execute("ALTER TABLE locations ADD COLUMN country_code TEXT")
        print("  locations.country_code added.")
    else:
        print("  locations.country_code already exists.")

    # ── suppliers: add country_code ──────────────────────────────────────────
    if not col_exists(cur, "suppliers", "country_code"):
        cur.execute("ALTER TABLE suppliers ADD COLUMN country_code TEXT")
        print("  suppliers.country_code added.")
    else:
        print("  suppliers.country_code already exists.")

    con.commit()
    con.close()
    print("migrate_v25 complete.")


if __name__ == "__main__":
    run()
