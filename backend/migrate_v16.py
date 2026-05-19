"""
migrate_v16.py — Phase 2H: Demand Planning
- Creates demand_signals table
- Updates users role constraint to include demand_planner
Run once: python migrate_v16.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    # 1. Create demand_signals table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS demand_signals (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id          INTEGER NOT NULL REFERENCES products(id),
            location_id         INTEGER REFERENCES locations(id),
            period_date         TEXT    NOT NULL,
            quantity            INTEGER NOT NULL DEFAULT 0,
            notes               TEXT,
            created_by_user_id  INTEGER REFERENCES users(id),
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("OK: demand_signals table created (or already exists)")

    # 2. Update users table to allow demand_planner role
    # SQLite requires recreating the table to change a CHECK constraint
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users_new'")
    if cur.fetchone():
        cur.execute("DROP TABLE users_new")

    cur.execute("""
        CREATE TABLE users_new (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            username            TEXT NOT NULL UNIQUE,
            email               TEXT UNIQUE,
            password_hash       TEXT NOT NULL,
            role                TEXT NOT NULL CHECK(role IN (
                                    'admin','supply_planner','warehouse_user',
                                    'repair_centre','supplier','demand_planner'
                                )),
            default_location_id INTEGER REFERENCES locations(id),
            active              INTEGER NOT NULL DEFAULT 1,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("INSERT INTO users_new SELECT * FROM users")
    cur.execute("DROP TABLE users")
    cur.execute("ALTER TABLE users_new RENAME TO users")
    print("OK: users table updated - demand_planner role allowed")

    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print("Migration v16 complete.")


if __name__ == "__main__":
    run()
