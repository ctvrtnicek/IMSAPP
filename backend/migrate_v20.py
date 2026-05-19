"""Migration v20: add outbound_order_id to claims table."""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if column exists
    cur.execute("PRAGMA table_info(claims)")
    cols = [r[1] for r in cur.fetchall()]

    if "outbound_order_id" not in cols:
        cur.execute("ALTER TABLE claims ADD COLUMN outbound_order_id INTEGER REFERENCES outbound_orders(id)")
        print("OK: outbound_order_id added to claims")
    else:
        print("OK: outbound_order_id already exists")

    conn.commit()
    conn.close()
    print("Migration v20 complete.")

if __name__ == "__main__":
    run()
