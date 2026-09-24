"""
Migration v29 — Inventory Moves report: which date a move counts on
  • MOVES_DATE_BASIS_SALES         warehouse → customer        (arrival | departure)
  • MOVES_DATE_BASIS_DISTRIBUTION  warehouse → warehouse       (arrival | departure)
  • MOVES_DATE_BASIS_REPAIR        warehouse → repair centre   (arrival | departure)
  Returns into a warehouse always count on arrival (receipt).
  data_type string (CHECK constraint); System Config renders a dropdown for these keys.
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")

ROWS = [
    ("MOVES_DATE_BASIS_SALES", "Inventory Moves — Sales date",
     "Date a warehouse → customer move counts on in the Inventory Moves report: arrival (delivered) or departure (shipped)."),
    ("MOVES_DATE_BASIS_DISTRIBUTION", "Inventory Moves — Distribution date",
     "Date a warehouse → warehouse move counts on: arrival (received at destination) or departure (shipped)."),
    ("MOVES_DATE_BASIS_REPAIR", "Inventory Moves — Repair date",
     "Date a warehouse → repair centre move counts on: arrival (received at repair centre) or departure (dispatched)."),
]


def run():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    for key, label, desc in ROWS:
        cur.execute("SELECT 1 FROM system_config WHERE config_key = ?", (key,))
        if cur.fetchone():
            print(f"{key}: exists")
            continue
        cur.execute(
            "INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value, updated_at) "
            "VALUES (?, ?, ?, 'string', 'arrival', 'arrival', CURRENT_TIMESTAMP)",
            (key, label, desc),
        )
        print(f"{key}: added")
    con.commit()
    con.close()


if __name__ == "__main__":
    run()
