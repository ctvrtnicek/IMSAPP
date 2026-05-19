"""
migrate_v14.py — Phase 2F: Work Orders

Creates:
  - work_orders table
  - work_order_lines table
  - Adds 'WO' entry to order_numbering
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("Creating work_orders table…")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS work_orders (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number        TEXT    NOT NULL UNIQUE,
            outbound_order_id   INTEGER NOT NULL REFERENCES outbound_orders(id),
            wo_type             TEXT    NOT NULL DEFAULT 'Pick',
            status              TEXT    NOT NULL DEFAULT 'Open',
            location_id         INTEGER REFERENCES locations(id),
            notes               TEXT,
            created_by_user_id  INTEGER REFERENCES users(id),
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    print("Creating work_order_lines table…")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS work_order_lines (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id           INTEGER NOT NULL REFERENCES work_orders(id),
            outbound_order_line_id  INTEGER REFERENCES outbound_order_lines(id),
            allocated_serial_id     INTEGER REFERENCES serial_numbers(id),
            confirmed_serial_id     INTEGER REFERENCES serial_numbers(id),
            is_short_pick           INTEGER NOT NULL DEFAULT 0,
            is_over_pick            INTEGER NOT NULL DEFAULT 0
        )
    """)

    print("Adding indexes…")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wo_outbound ON work_orders(outbound_order_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_wol_wo ON work_order_lines(work_order_id)")

    print("Seeding WO order_numbering entry…")
    cur.execute("""
        INSERT OR IGNORE INTO order_numbering (order_type, prefix, padding_length, current_sequence)
        VALUES ('WO', 'WO', 6, 0)
    """)

    conn.commit()
    conn.close()
    print("Migration v14 complete.")


if __name__ == "__main__":
    run()
