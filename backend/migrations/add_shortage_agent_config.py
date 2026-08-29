"""
Migration: Add IMS_InventoryShortage agent config keys to system_config.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "terminal_tracking.db"

AGENT_CONFIGS = [
    ("AGENT_SHORTAGE_ENABLED",       "Shortage Agent — Enabled",             "Enable or disable the IMS_InventoryShortage autonomous agent.",                          "boolean", "0",     "0"),
    ("AGENT_SHORTAGE_RUN_TIME_1",    "Shortage Agent — Run Time 1",          "First daily run time in CET (HH:MM format). Default: 09:00.",                            "string",  "09:00", "09:00"),
    ("AGENT_SHORTAGE_RUN_TIME_2",    "Shortage Agent — Run Time 2",          "Second daily run time in CET (HH:MM format). Default: 15:00.",                           "string",  "15:00", "15:00"),
    ("AGENT_SHORTAGE_HITL_QTY",      "Shortage Agent — HITL Qty Threshold",  "Pause for human approval when shortage qty exceeds this value. Default: 100.",           "integer", "100",   "100"),
    ("AGENT_SHORTAGE_HITL_VALUE",    "Shortage Agent — HITL Value Threshold","Pause for human approval when estimated order value (€) exceeds this. Default: 5000.",   "decimal", "5000",  "5000"),
    ("AGENT_SHORTAGE_EMAIL_TO",      "Shortage Agent — Email Recipient",     "Email address(es) for agent run summaries (comma-separated).",                           "string",  "",      ""),
    ("AGENT_SHORTAGE_HORIZON_DAYS",  "Shortage Agent — Horizon (days)",      "Number of days ahead to flag shortages against safety stock. Default: 30.",              "integer", "30",    "30"),
    ("AGENT_SHORTAGE_MIN_SHORTAGE",  "Shortage Agent — Min Shortage Qty",    "Ignore shortages below this unit count (noise filter). Default: 1.",                     "integer", "1",     "1"),
]


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for key, label, desc, dtype, default, current in AGENT_CONFIGS:
        cur.execute("SELECT id FROM system_config WHERE config_key = ?", (key,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO system_config (config_key, label, description, data_type, default_value, current_value) VALUES (?,?,?,?,?,?)",
                (key, label, desc, dtype, default, current),
            )
            print(f"  Inserted: {key}")
        else:
            print(f"  Already exists: {key}")
    conn.commit()
    conn.close()
    print("Shortage agent config migration complete.")


if __name__ == "__main__":
    run()
