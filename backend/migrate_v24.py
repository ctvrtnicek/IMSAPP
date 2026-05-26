"""
Phase 3B DB migration — migrate_v24.py
Adds missing columns to terminals, bom_components, and seeds default regions.
Run once: python migrate_v24.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")


def col_exists(cur, table, col):
    cur.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cur.fetchall())


def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=== Phase 3B Migration ===")

    # ── serial_numbers (terminals) ─────────────────────────────────────────────
    if not col_exists(cur, "serial_numbers", "firmware_id"):
        cur.execute("ALTER TABLE serial_numbers ADD COLUMN firmware_id INTEGER REFERENCES firmware(id)")
        print("  + serial_numbers.firmware_id")
    else:
        print("  = serial_numbers.firmware_id already exists")

    if not col_exists(cur, "serial_numbers", "firmware_applied_at"):
        cur.execute("ALTER TABLE serial_numbers ADD COLUMN firmware_applied_at TIMESTAMP")
        print("  + serial_numbers.firmware_applied_at")
    else:
        print("  = serial_numbers.firmware_applied_at already exists")

    # ── bom_components ─────────────────────────────────────────────────────────
    if not col_exists(cur, "bom_components", "quantity"):
        cur.execute("ALTER TABLE bom_components ADD COLUMN quantity DECIMAL DEFAULT 1")
        print("  + bom_components.quantity")
    else:
        print("  = bom_components.quantity already exists")

    if not col_exists(cur, "bom_components", "assembly_leadtime_value"):
        cur.execute("ALTER TABLE bom_components ADD COLUMN assembly_leadtime_value INTEGER")
        print("  + bom_components.assembly_leadtime_value")
    else:
        print("  = bom_components.assembly_leadtime_value already exists")

    if not col_exists(cur, "bom_components", "assembly_leadtime_unit"):
        cur.execute("ALTER TABLE bom_components ADD COLUMN assembly_leadtime_unit TEXT")
        print("  + bom_components.assembly_leadtime_unit")
    else:
        print("  = bom_components.assembly_leadtime_unit already exists")

    # ── products ───────────────────────────────────────────────────────────────
    # latest_firmware_id was added in v23 — guard just in case
    if not col_exists(cur, "products", "latest_firmware_id"):
        cur.execute("ALTER TABLE products ADD COLUMN latest_firmware_id INTEGER REFERENCES firmware(id)")
        print("  + products.latest_firmware_id")
    else:
        print("  = products.latest_firmware_id already exists")

    # ── Seed default regions ───────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM regions")
    if cur.fetchone()[0] == 0:
        for code, name in [("EMEA", "Europe, Middle East & Africa"),
                           ("APAC", "Asia Pacific"),
                           ("NA",   "North America"),
                           ("SA",   "South America")]:
            cur.execute(
                "INSERT OR IGNORE INTO regions (region_code, region_name, active) VALUES (?,?,1)",
                (code, name)
            )
        print("  + Seeded 4 default regions (EMEA, APAC, NA, SA)")
    else:
        print("  = Regions already seeded")

    conn.commit()
    conn.close()
    print("=== Migration complete ===")


if __name__ == "__main__":
    migrate()
