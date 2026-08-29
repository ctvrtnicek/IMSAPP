"""Phase 3D — Quality Hold + PO Price"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'terminal_tracking.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # QUALITY_HOLD state should already exist from migrate_v23
    c.execute("SELECT id FROM terminal_states WHERE code='QUALITY_HOLD'")
    if not c.fetchone():
        c.execute("INSERT INTO terminal_states (code, display_name, warehouse_type, sequence_number) VALUES ('QUALITY_HOLD', 'Quality Hold', 'Pre-Warehouse', 2)")

    # Seed alert rule QUALITY_HOLD_RAISED
    c.execute("SELECT id FROM alert_rules WHERE rule_code='QUALITY_HOLD_RAISED'")
    if not c.fetchone():
        c.execute("""INSERT INTO alert_rules (rule_code, name, description, enabled)
            VALUES ('QUALITY_HOLD_RAISED', 'Quality Hold Raised', 'Triggered when a terminal is placed in Quality Hold state during PO receiving', 1)""")

    # PO line price fields
    try: c.execute("ALTER TABLE purchase_order_lines ADD COLUMN price_per_product REAL")
    except: pass
    try: c.execute("ALTER TABLE purchase_order_lines ADD COLUMN price_currency TEXT")
    except: pass

    conn.commit()
    conn.close()
    print("Phase 3D migration applied.")

if __name__ == "__main__":
    run()
