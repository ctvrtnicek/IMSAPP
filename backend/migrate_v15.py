"""migrate_v15.py — Phase 2G: Claims Management tables"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")

def run():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS claim_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            raised_against TEXT NOT NULL DEFAULT 'Supplier',
            active INTEGER NOT NULL DEFAULT 1
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claim_number TEXT NOT NULL UNIQUE,
            po_id INTEGER REFERENCES purchase_orders(id),
            serial_id INTEGER REFERENCES serial_numbers(id),
            claim_type_id INTEGER NOT NULL REFERENCES claim_types(id),
            raised_against TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Open',
            description TEXT,
            resolution_notes TEXT,
            created_by_user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    defaults = [
        ("Missing Serial", "Serial number expected but not received", "Supplier"),
        ("Damaged on Arrival", "Serial received in damaged condition", "Carrier"),
        ("Wrong Product", "Received product does not match PO line", "Supplier"),
        ("Short Shipment", "Fewer units received than ordered", "Supplier"),
        ("Excess Shipment", "More units received than ordered", "Supplier"),
        ("Transit Damage", "Damage occurred during transit", "Carrier"),
    ]
    for name, desc, against in defaults:
        cur.execute("INSERT OR IGNORE INTO claim_types (name, description, raised_against, active) VALUES (?, ?, ?, 1)",
                    (name, desc, against))

    cur.execute("INSERT OR IGNORE INTO order_numbering (order_type, prefix, current_sequence, padding_length) VALUES ('Claim','CL',0,6)")

    conn.commit()
    conn.close()
    print("migrate_v15 done")

if __name__ == "__main__":
    run()
