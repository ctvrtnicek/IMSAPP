"""
migrate_v22.py — Product images

Adds image_data (BLOB) and image_content_type (TEXT) columns to the products table.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    existing = {row[1] for row in cur.execute("PRAGMA table_info(products)")}
    for col, defn in [("image_data", "BLOB"), ("image_content_type", "TEXT")]:
        if col not in existing:
            cur.execute(f"ALTER TABLE products ADD COLUMN {col} {defn}")
            print(f"  + products.{col}")
        else:
            print(f"  products.{col} already exists — skipped")

    con.commit()
    con.close()
    print("migrate_v22 complete.")


if __name__ == "__main__":
    run()
