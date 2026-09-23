"""
Migration v26 — R3 #16 repair order documents
  • create repair_order_documents (FK -> repair_orders, file bytes stored in DB)
  • drop the old repair_documents table (FK pointed at repair_rework_orders by
    mistake, files were stored on local disk). Only dropped if it is empty.
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")


def run():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS repair_order_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id),
            file_name TEXT NOT NULL,
            content_type TEXT,
            data BLOB NOT NULL,
            file_size_bytes INTEGER,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uploaded_by_user_id INTEGER REFERENCES users(id)
        )
    """)
    print("repair_order_documents: ensured")

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='repair_documents'")
    if cur.fetchone():
        n = cur.execute("SELECT COUNT(*) FROM repair_documents").fetchone()[0]
        if n:
            print(f"repair_documents has {n} row(s) — NOT dropped, migrate them by hand first")
        else:
            cur.execute("DROP TABLE repair_documents")
            print("repair_documents: dropped (was empty)")

    con.commit()
    con.close()


if __name__ == "__main__":
    run()
