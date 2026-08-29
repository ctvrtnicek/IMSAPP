"""
Migration: add agent_runs + agent_allocation_intents tables,
           seed 2 new AGENT_* system_config keys.
Run once: python migrations/add_agent_v2_tables.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import SessionLocal, engine
from sqlalchemy import text

DDL = [
    """
    CREATE TABLE IF NOT EXISTS agent_runs (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id           TEXT    NOT NULL UNIQUE,
        agent_name       TEXT    NOT NULL,
        triggered_by     TEXT,
        status           TEXT    NOT NULL DEFAULT 'running',
        shortages_found  INTEGER DEFAULT 0,
        actions_taken    INTEGER DEFAULT 0,
        hitl_items       INTEGER DEFAULT 0,
        intents_recorded INTEGER DEFAULT 0,
        intents_executed INTEGER DEFAULT 0,
        summary_text     TEXT,
        started_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at     TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_allocation_intents (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id               TEXT    NOT NULL,
        agent_name           TEXT    NOT NULL,
        product_id           INTEGER REFERENCES products(id),
        from_location_id     INTEGER REFERENCES locations(id),
        to_location_id       INTEGER REFERENCES locations(id),
        reserved_qty         INTEGER NOT NULL DEFAULT 0,
        remaining_qty        INTEGER NOT NULL DEFAULT 0,
        reasoning            TEXT,
        status               TEXT    NOT NULL DEFAULT 'Pending',
        horizon_days         INTEGER DEFAULT 14,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at          TIMESTAMP,
        cancelled_at         TIMESTAMP,
        cancelled_by_user_id INTEGER REFERENCES users(id),
        execution_do_refs    TEXT
    )
    """,
]

SEEDS = [
    ("AGENT_PIPELINE_STATES",    "Pipeline States",   "RECEIVED,STAGING,QC_HOLD,RECHARGED,KEYLOADED",
     "Comma-separated state codes treated as pipeline inventory by the shortage agent"),
    ("AGENT_INTENT_HORIZON_DAYS", "Intent Horizon Days", "14",
     "Cancel allocation intents not executed within this many days"),
]

def run():
    with engine.connect() as conn:
        for ddl in DDL:
            conn.execute(text(ddl))
        conn.commit()
    print("Tables created (or already exist).")

    db = SessionLocal()
    try:
        from models import SystemConfig
        for key, label, val, desc in SEEDS:
            existing = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
            if not existing:
                db.add(SystemConfig(config_key=key, label=label, current_value=val,
                                    description=desc, data_type="string"))
                print(f"  Seeded {key} = {val}")
            else:
                print(f"  Skipped {key} (already exists)")
        db.commit()
    finally:
        db.close()
    print("Migration complete.")

if __name__ == "__main__":
    run()
