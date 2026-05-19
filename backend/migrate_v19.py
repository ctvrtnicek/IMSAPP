"""
migrate_v19.py — adds urgency and attachment support to claims
Run once: python migrate_v19.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(claims)")
    cols = [r[1] for r in cur.fetchall()]

    if "urgency" not in cols:
        cur.execute("ALTER TABLE claims ADD COLUMN urgency TEXT NOT NULL DEFAULT 'Normal'")
        print("OK: urgency added to claims")
    else:
        print("OK: urgency already exists")

    # Create claim_attachments table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS claim_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            content_type TEXT,
            data BLOB NOT NULL,
            uploaded_by_user_id INTEGER REFERENCES users(id),
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("OK: claim_attachments table ready")

    conn.commit()
    conn.close()
    print("Migration v19 complete.")

if __name__ == "__main__":
    run()
