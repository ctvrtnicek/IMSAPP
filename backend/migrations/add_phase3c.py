"""Phase 3C migration — ATP, BOM process, Outbound Allocation"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'terminal_tracking.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Customer: segment_id
    try: c.execute("ALTER TABLE customers ADD COLUMN segment_id INTEGER REFERENCES customer_segments(id)")
    except: pass

    # SerialNumber: pegged_to_order_id
    try: c.execute("ALTER TABLE serial_numbers ADD COLUMN pegged_to_order_id INTEGER REFERENCES outbound_orders(id)")
    except: pass

    # OutboundOrderLine: ATP fields
    try: c.execute("ALTER TABLE outbound_order_lines ADD COLUMN fulfilling_location_id INTEGER REFERENCES locations(id)")
    except: pass
    try: c.execute("ALTER TABLE outbound_order_lines ADD COLUMN edd TEXT")
    except: pass
    try: c.execute("ALTER TABLE outbound_order_lines ADD COLUMN atp_status TEXT")
    except: pass
    try: c.execute("ALTER TABLE outbound_order_lines ADD COLUMN component_transfer_orders TEXT")
    except: pass
    try: c.execute("ALTER TABLE outbound_order_lines ADD COLUMN bom_assembly_status TEXT")
    except: pass

    # OutboundOrder: allocation_source_order_id
    try: c.execute("ALTER TABLE outbound_orders ADD COLUMN allocation_source_order_id INTEGER REFERENCES outbound_orders(id)")
    except: pass

    # Create customer_segments table if not exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS customer_segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            segment_code TEXT NOT NULL UNIQUE,
            segment_name TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 99
        )
    """)

    # Create atp_rules table if not exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS atp_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            region_id INTEGER REFERENCES regions(id),
            segment_id INTEGER REFERENCES customer_segments(id),
            rule_key TEXT NOT NULL,
            rule_value TEXT NOT NULL,
            description TEXT
        )
    """)

    # Seed default segments
    for code, name, priority in [("ENT", "Enterprise", 10), ("SMB", "Small & Medium Business", 50), ("PTR", "Partner", 30)]:
        c.execute("SELECT id FROM customer_segments WHERE segment_code = ?", (code,))
        if not c.fetchone():
            c.execute("INSERT INTO customer_segments (segment_code, segment_name, priority) VALUES (?, ?, ?)", (code, name, priority))

    conn.commit()
    conn.close()
    print("Phase 3C migration applied successfully.")

if __name__ == "__main__":
    run()
