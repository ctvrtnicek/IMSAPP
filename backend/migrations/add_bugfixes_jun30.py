"""Bug fixes 2026-06-30 — shipment info on serials, supplier_id on users"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'terminal_tracking.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ENH-001: shipment info on serial_numbers (for PO serials display)
    try: c.execute("ALTER TABLE serial_numbers ADD COLUMN shipment_reference TEXT")
    except: pass

    try: c.execute("ALTER TABLE serial_numbers ADD COLUMN carrier TEXT")
    except: pass

    # CR-001: supplier assignment on users
    try: c.execute("ALTER TABLE users ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)")
    except: pass

    # Ensure ReturnOrder / RepairReworkOrder numbering rows exist (BUG-002 defence)
    c.execute("SELECT id FROM order_numbering WHERE order_type='ReturnOrder'")
    if not c.fetchone():
        c.execute("INSERT INTO order_numbering (order_type, prefix, padding_length, current_sequence) VALUES ('ReturnOrder','RE',6,0)")

    c.execute("SELECT id FROM order_numbering WHERE order_type='RepairReworkOrder'")
    if not c.fetchone():
        c.execute("INSERT INTO order_numbering (order_type, prefix, padding_length, current_sequence) VALUES ('RepairReworkOrder','RR',6,0)")

    conn.commit()
    conn.close()
    print("Bugfix migration (2026-06-30) applied.")

if __name__ == "__main__":
    run()
