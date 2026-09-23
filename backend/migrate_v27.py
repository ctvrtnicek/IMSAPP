"""
Migration v27 — R3 #9 BOM process
  • accessory_reservations: reservations of non-serialised stock per order line/location
  • work_orders: started_at, requires_assembly, assembly_confirmed_at,
    assembly_confirmed_by_user_id, production_minutes
  • work_order_lines: product_id, quantity, confirmed_quantity (accessory pick lines)
  • alert_rules: COMPONENT_SHORTAGE, RESERVATION_AT_RISK
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")


def col_exists(cursor, table, col):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cursor.fetchall())


def add_col(cur, table, col, ddl):
    if not col_exists(cur, table, col):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
        print(f"{table}.{col}: added")


def run():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS accessory_reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES outbound_orders(id),
            order_line_id INTEGER NOT NULL REFERENCES outbound_order_lines(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            location_id INTEGER NOT NULL REFERENCES locations(id),
            quantity INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Reserved',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP
        )
    """)
    print("accessory_reservations: ensured")

    add_col(cur, "work_orders", "started_at", "TIMESTAMP")
    add_col(cur, "work_orders", "requires_assembly", "INTEGER NOT NULL DEFAULT 0")
    add_col(cur, "work_orders", "assembly_confirmed_at", "TIMESTAMP")
    add_col(cur, "work_orders", "assembly_confirmed_by_user_id", "INTEGER REFERENCES users(id)")
    add_col(cur, "work_orders", "production_minutes", "INTEGER")

    add_col(cur, "work_order_lines", "product_id", "INTEGER REFERENCES products(id)")
    add_col(cur, "work_order_lines", "quantity", "INTEGER")
    add_col(cur, "work_order_lines", "confirmed_quantity", "INTEGER")

    for code, name, desc in (
        ("COMPONENT_SHORTAGE", "BOM Component Shortage",
         "A BOM component needed for an outbound order is not available anywhere in the network."),
        ("RESERVATION_AT_RISK", "Accessory Reservation At Risk",
         "A shipment used accessory stock that was reserved for another order."),
    ):
        cur.execute("SELECT 1 FROM alert_rules WHERE rule_code = ?", (code,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO alert_rules (rule_code, name, description, enabled, created_at, updated_at) "
                "VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (code, name, desc),
            )
            print(f"alert_rules.{code}: added")

    con.commit()
    con.close()


if __name__ == "__main__":
    run()
