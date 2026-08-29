"""
Migration: Create agent_logs and agent_recommendations tables.
Also seeds SMTP config keys in system_config.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "terminal_tracking.db"

SMTP_CONFIGS = [
    ("SMTP_HOST",     "Email — SMTP Host",     "SMTP server hostname (e.g. smtp.gmail.com).",             "string",  "", ""),
    ("SMTP_PORT",     "Email — SMTP Port",     "SMTP server port (587=TLS, 465=SSL).",                    "integer", "587", "587"),
    ("SMTP_USER",     "Email — SMTP Username", "SMTP login username or email address.",                    "string",  "", ""),
    ("SMTP_PASSWORD", "Email — SMTP Password", "SMTP login password.",                                     "string",  "", ""),
    ("SMTP_FROM",     "Email — From Address",  "From address shown on agent summary emails.",              "string",  "", ""),
]


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS agent_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id      TEXT NOT NULL,
            agent_name  TEXT NOT NULL,
            step_type   TEXT NOT NULL,
            message     TEXT,
            order_ref   TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  agent_logs: OK")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS agent_recommendations (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id              TEXT NOT NULL,
            agent_name          TEXT NOT NULL,
            rec_type            TEXT NOT NULL,
            product_id          INTEGER REFERENCES products(id),
            from_location_id    INTEGER REFERENCES locations(id),
            to_location_id      INTEGER REFERENCES locations(id),
            qty                 INTEGER,
            shortage_qty        INTEGER,
            estimated_value     REAL,
            status              TEXT NOT NULL DEFAULT 'Pending',
            order_ref           TEXT,
            notes               TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            actioned_at         TIMESTAMP,
            actioned_by_user_id INTEGER REFERENCES users(id)
        )
    """)
    print("  agent_recommendations: OK")

    for key, label, desc, dtype, default, current in SMTP_CONFIGS:
        cur.execute("SELECT id FROM system_config WHERE config_key = ?", (key,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO system_config (config_key, label, description, data_type, default_value, current_value) VALUES (?,?,?,?,?,?)",
                (key, label, desc, dtype, default, current),
            )
            print(f"  Inserted config: {key}")
        else:
            print(f"  Config exists: {key}")

    conn.commit()
    conn.close()
    print("Agent tables migration complete.")


if __name__ == "__main__":
    run()
