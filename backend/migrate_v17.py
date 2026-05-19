"""
migrate_v17.py — Phase 2I: Supply Planning + Repositioning
- Creates safety_stock_targets table
Run once: python migrate_v17.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS safety_stock_targets (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id          INTEGER NOT NULL REFERENCES products(id),
            location_id         INTEGER NOT NULL REFERENCES locations(id),
            min_qty             INTEGER NOT NULL DEFAULT 0,
            reorder_point       INTEGER NOT NULL DEFAULT 0,
            reorder_qty         INTEGER NOT NULL DEFAULT 0,
            notes               TEXT,
            created_by_user_id  INTEGER REFERENCES users(id),
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(product_id, location_id)
        )
    """)
    print("OK: safety_stock_targets table created (or already exists)")

    conn.commit()
    conn.close()
    print("Migration v17 complete.")


if __name__ == "__main__":
    run()
