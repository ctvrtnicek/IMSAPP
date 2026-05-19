"""
migrate_v18.py — Phase 2I enhancement
- Adds lead_time_days column to product_suppliers
- Recreates product_suppliers with lead_time_days (SQLite requires table rebuild for new columns with constraints)
Run once: python migrate_v18.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    # Check if lead_time_days already exists
    cur.execute("PRAGMA table_info(product_suppliers)")
    cols = [r[1] for r in cur.fetchall()]
    if "lead_time_days" not in cols:
        cur.execute("ALTER TABLE product_suppliers ADD COLUMN lead_time_days INTEGER")
        print("OK: lead_time_days added to product_suppliers")
    else:
        print("OK: lead_time_days already exists")

    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print("Migration v18 complete.")


if __name__ == "__main__":
    run()
