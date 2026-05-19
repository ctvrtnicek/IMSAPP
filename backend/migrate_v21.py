"""
migrate_v21.py — Phase 2K: Alerting Framework

Changes:
1. Add battery_life_days, warranty_days, repair_max_days to products table
2. Make work_orders.outbound_order_id nullable (table recreation for SQLite)
3. Add RECHARGED terminal state
4. Create alert_rules table with default rules
5. Create alerts table
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"

ALERT_RULES = [
    ("RETURN_RECEIVED",    "Return Received",       "A new return has arrived requiring warehouse action.", 1, None, None),
    ("REPAIR_OVERDUE",     "Repair Overdue",         "Terminal has been in repair longer than the product's repair_max_days threshold.", 1, None, None),
    ("TRANSIT_DELAY",      "In-Transit Delay",       "Terminal in transit is overdue based on expected lead time.", 1, 1, 2),
    ("LOW_STOCK",          "Low Stock",              "Stock at a location has fallen below the safety stock reorder point.", 1, None, None),
    ("BATTERY_AGING",      "Battery Aging",          "Terminal battery is approaching or past its expected recharge interval.", 1, None, None),
    ("WARRANTY_EXPIRY",    "Warranty Expiry",         "Terminal warranty is approaching expiry or has expired.", 1, 30, 0),
]


def run():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # ------------------------------------------------------------------
    # 1. Products — new alerting fields
    # ------------------------------------------------------------------
    existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(products)")}
    for col, definition in [
        ("battery_life_days", "INTEGER"),
        ("warranty_days",     "INTEGER"),
        ("repair_max_days",   "INTEGER"),
    ]:
        if col not in existing_cols:
            cur.execute(f"ALTER TABLE products ADD COLUMN {col} {definition}")
            print(f"  + products.{col}")

    # ------------------------------------------------------------------
    # 2. work_orders — make outbound_order_id nullable
    #    SQLite requires table recreation for this
    # ------------------------------------------------------------------
    wo_cols = {row[1]: row for row in cur.execute("PRAGMA table_info(work_orders)")}
    # Check if it's currently NOT NULL
    if "outbound_order_id" in wo_cols:
        col_info = wo_cols["outbound_order_id"]
        notnull = col_info[3]  # 1 = NOT NULL
        if notnull:
            print("  Recreating work_orders to make outbound_order_id nullable…")
            cur.executescript("""
                CREATE TABLE work_orders_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_number TEXT NOT NULL UNIQUE,
                    outbound_order_id INTEGER REFERENCES outbound_orders(id),
                    wo_type TEXT NOT NULL DEFAULT 'Pick',
                    status TEXT NOT NULL DEFAULT 'Open',
                    location_id INTEGER REFERENCES locations(id),
                    notes TEXT,
                    created_by_user_id INTEGER REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO work_orders_new SELECT
                    id, order_number, outbound_order_id, wo_type, status,
                    location_id, notes, created_by_user_id, created_at
                FROM work_orders;
                DROP TABLE work_orders;
                ALTER TABLE work_orders_new RENAME TO work_orders;
            """)
            print("  work_orders recreated.")
        else:
            print("  work_orders.outbound_order_id already nullable — skipped.")

    # ------------------------------------------------------------------
    # 3. RECHARGED terminal state
    # ------------------------------------------------------------------
    existing_state = cur.execute(
        "SELECT id FROM terminal_states WHERE code = 'RECHARGED'"
    ).fetchone()
    if not existing_state:
        cur.execute("""
            INSERT INTO terminal_states (code, display_name, description, active)
            VALUES ('RECHARGED', 'Recharged', 'Battery recharged and ready for use', 1)
        """)
        print("  + terminal_state RECHARGED")

    # ------------------------------------------------------------------
    # 4. alert_rules table
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alert_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            threshold_urgent_days INTEGER,
            threshold_critical_days INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for rule in ALERT_RULES:
        cur.execute("""
            INSERT OR IGNORE INTO alert_rules
                (rule_code, name, description, enabled, threshold_urgent_days, threshold_critical_days)
            VALUES (?, ?, ?, ?, ?, ?)
        """, rule)
    print("  + alert_rules table + default rules")

    # ------------------------------------------------------------------
    # 5. alerts table
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
            severity TEXT NOT NULL DEFAULT 'Normal',
            status TEXT NOT NULL DEFAULT 'New',
            serial_id INTEGER REFERENCES serial_numbers(id),
            product_id INTEGER REFERENCES products(id),
            location_id INTEGER REFERENCES locations(id),
            reference_id INTEGER,
            reference_type TEXT,
            message TEXT NOT NULL,
            days_overdue INTEGER,
            acknowledged_by_user_id INTEGER REFERENCES users(id),
            acknowledged_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  + alerts table")

    con.commit()
    con.close()
    print("migrate_v21 complete.")


if __name__ == "__main__":
    run()
