"""R3 Enhancement migrations — adds new columns for GR, accruals, country currency, network version current flag."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'terminal_tracking.db')


def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # LocationType: gr_applicable, accruals_applicable
    try:
        c.execute("ALTER TABLE location_types ADD COLUMN gr_applicable INTEGER NOT NULL DEFAULT 1")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE location_types ADD COLUMN accruals_applicable TEXT NOT NULL DEFAULT 'NA'")
    except Exception:
        pass

    # Country: currency
    try:
        c.execute("ALTER TABLE countries ADD COLUMN currency TEXT")
    except Exception:
        pass

    # NetworkVersion: is_current
    try:
        c.execute("ALTER TABLE network_versions ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0")
    except Exception:
        pass

    # GoodsReceiptMessage table
    c.execute("""
        CREATE TABLE IF NOT EXISTS goods_receipt_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_id INTEGER REFERENCES purchase_orders(id),
            location_id INTEGER NOT NULL REFERENCES locations(id),
            message_type TEXT NOT NULL,
            serial_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by_user_id INTEGER REFERENCES users(id)
        )
    """)

    # Seed GR_OUTBOUND_MESSAGE_ENABLED config if not exists
    c.execute("SELECT id FROM system_config WHERE config_key = 'GR_OUTBOUND_MESSAGE_ENABLED'")
    if not c.fetchone():
        c.execute("""
            INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value)
            VALUES ('GR_OUTBOUND_MESSAGE_ENABLED', 'GR Outbound Message', 'Generate outbound Goods Receipt message upon receiving or reversing goods receipt', 'boolean', '0', '0')
        """)

    conn.commit()
    conn.close()
    print("R3 enhancement migrations applied successfully.")


if __name__ == "__main__":
    run()
