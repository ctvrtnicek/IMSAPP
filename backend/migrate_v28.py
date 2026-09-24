"""
Migration v28 — R3 #12 AI Assistant settings
  • system_config AI_MODEL: one Claude model for the whole platform
  • system_config AI_ASSISTANT_ROLES: roles that get the assistant (comma-separated)
  Both are data_type string (the table has a CHECK constraint); the System Config page
  renders a model dropdown / role checklist for these keys.
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "terminal_tracking.db")

ROWS = [
    ("AI_MODEL", "AI Model (platform)",
     "Claude model used by every AI feature: AI Assistant, document processor, shortage agent.",
     "string", "claude-opus-5"),
    ("AI_ASSISTANT_ROLES", "AI Assistant — Roles",
     "Roles that see the AI Assistant (AI_ASSISTANT_ENABLED must also be on).",
     "string",
     "admin,supply_planner,demand_planner,warehouse_user,inbound_specialist,"
     "outbound_specialist,rma_manager,senior_management"),
]


def run():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    for key, label, desc, dtype, default in ROWS:
        cur.execute("SELECT 1 FROM system_config WHERE config_key = ?", (key,))
        if cur.fetchone():
            print(f"{key}: exists")
            continue
        cur.execute(
            "INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            (key, label, desc, dtype, default, default),
        )
        print(f"{key}: added")
    con.commit()
    con.close()


if __name__ == "__main__":
    run()
