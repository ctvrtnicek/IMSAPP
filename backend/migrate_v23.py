"""
migrate_v23.py — Phase 3A Foundations

Creates:
  - user_roles   (multi-role assignment, many-to-many)
  - user_locations (location scoping, many-to-many)
  - user_regions   (region scoping, many-to-many)
  - system_config  (centralised configurable parameters)
  - regions        (EMEA, APAC, NA, SA)
  - countries      (empty — populated by admin)

Migrates existing single users.role values into user_roles rows.
Seeds system_config with R3 initial parameters.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def run():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = OFF")
    cur = con.cursor()

    # ------------------------------------------------------------------
    # 1. regions
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS regions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            region_code  TEXT NOT NULL UNIQUE,
            region_name  TEXT NOT NULL,
            active       INTEGER NOT NULL DEFAULT 1
        )
    """)
    for code, name in [('EMEA','Europe Middle East & Africa'),('APAC','Asia Pacific'),('NA','North America'),('SA','South America')]:
        cur.execute("INSERT OR IGNORE INTO regions (region_code, region_name) VALUES (?,?)", (code, name))
    print("  + regions seeded")

    # ------------------------------------------------------------------
    # 2. countries
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS countries (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            country_code  TEXT NOT NULL UNIQUE,
            country_name  TEXT NOT NULL,
            region_id     INTEGER NOT NULL REFERENCES regions(id),
            serviced      INTEGER NOT NULL DEFAULT 0,
            activated_at  TIMESTAMP
        )
    """)
    print("  + countries table ready")

    # ------------------------------------------------------------------
    # 3. user_roles
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_roles (
            user_id      INTEGER NOT NULL REFERENCES users(id),
            role_code    TEXT NOT NULL,
            assigned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, role_code)
        )
    """)
    print("  + user_roles table ready")

    # Seed from existing users.role (idempotent via INSERT OR IGNORE)
    cur.execute("SELECT id, role FROM users WHERE role IS NOT NULL AND role != ''")
    migrated = 0
    for user_id, role in cur.fetchall():
        cur.execute(
            "INSERT OR IGNORE INTO user_roles (user_id, role_code) VALUES (?,?)",
            (user_id, role)
        )
        migrated += 1
    print(f"  + migrated {migrated} existing user role(s) into user_roles")

    # ------------------------------------------------------------------
    # 4. user_locations
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_locations (
            user_id      INTEGER NOT NULL REFERENCES users(id),
            location_id  INTEGER NOT NULL REFERENCES locations(id),
            PRIMARY KEY (user_id, location_id)
        )
    """)
    # Seed from users.default_location_id where set
    cur.execute("SELECT id, default_location_id FROM users WHERE default_location_id IS NOT NULL")
    loc_migrated = 0
    for user_id, loc_id in cur.fetchall():
        cur.execute(
            "INSERT OR IGNORE INTO user_locations (user_id, location_id) VALUES (?,?)",
            (user_id, loc_id)
        )
        loc_migrated += 1
    print(f"  + user_locations table ready ({loc_migrated} seeded from default_location_id)")

    # ------------------------------------------------------------------
    # 5. user_regions
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_regions (
            user_id    INTEGER NOT NULL REFERENCES users(id),
            region_id  INTEGER NOT NULL REFERENCES regions(id),
            PRIMARY KEY (user_id, region_id)
        )
    """)
    print("  + user_regions table ready")

    # ------------------------------------------------------------------
    # 6. system_config
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS system_config (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key          TEXT NOT NULL UNIQUE,
            label               TEXT NOT NULL,
            description         TEXT,
            data_type           TEXT NOT NULL CHECK(data_type IN ('string','integer','boolean','decimal')),
            current_value       TEXT,
            default_value       TEXT,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by_user_id  INTEGER REFERENCES users(id)
        )
    """)
    seed_configs = [
        ('AI_ASSISTANT_ENABLED',           'AI Assistant Enabled',            'Show AI assistant chat panel in navigation bar',                   'boolean', '0',  '0'),
        ('ANTHROPIC_API_KEY',              'Anthropic API Key',               'API key for Claude AI assistant and document processor (masked)',  'string',  '',   ''),
        ('ATP_REALLOCATION_LOOKBACK_DAYS', 'ATP Reallocation Look-back Days', 'Maximum days back for outbound order reallocation eligibility',    'integer', '30', '30'),
        ('AI_DOCUMENT_PROCESSOR_ENABLED',  'AI Document Processor Enabled',   'Enable AI extraction for supplier document uploads on PO serials', 'boolean', '0',  '0'),
    ]
    for row in seed_configs:
        cur.execute(
            "INSERT OR IGNORE INTO system_config (config_key,label,description,data_type,current_value,default_value) VALUES (?,?,?,?,?,?)",
            row
        )
    print("  + system_config table ready with 4 seed parameters")

    # ------------------------------------------------------------------
    # 7. network_versions, supply_flows, flow_constraints
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS network_versions (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            version_name         TEXT NOT NULL,
            version_type         TEXT NOT NULL CHECK(version_type IN ('baseline','simulation')),
            reference_number     TEXT,
            effective_date       DATE,
            committed_at         TIMESTAMP,
            committed_by_user_id INTEGER REFERENCES users(id),
            notes                TEXT,
            created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS supply_flows (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            network_version_id INTEGER NOT NULL REFERENCES network_versions(id),
            from_location_id   INTEGER NOT NULL REFERENCES locations(id),
            to_location_id     INTEGER NOT NULL REFERENCES locations(id),
            flow_type          TEXT NOT NULL CHECK(flow_type IN ('A','B','C','D','E','F','G','H','I')),
            active             INTEGER NOT NULL DEFAULT 1
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS flow_constraints (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            flow_id            INTEGER NOT NULL REFERENCES supply_flows(id),
            product_id         INTEGER REFERENCES products(id),
            replenishment_type TEXT,
            valid_from         DATE,
            valid_to           DATE
        )
    """)
    print("  + network_versions / supply_flows / flow_constraints tables ready")

    # ------------------------------------------------------------------
    # 8. customer_segments
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS customer_segments (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            segment_code   TEXT NOT NULL UNIQUE,
            segment_name   TEXT NOT NULL,
            priority       INTEGER NOT NULL DEFAULT 99
        )
    """)
    print("  + customer_segments table ready")

    # ------------------------------------------------------------------
    # 9. firmware
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS firmware (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            firmware_name  TEXT NOT NULL,
            version        TEXT NOT NULL,
            release_number TEXT,
            release_date   DATE,
            release_hour   TEXT,
            key_used       TEXT,
            file_path      TEXT,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(firmware_name, version, release_number)
        )
    """)
    print("  + firmware table ready")

    # ------------------------------------------------------------------
    # 10. product_pricing, product_alternatives
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS product_pricing (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id         INTEGER NOT NULL REFERENCES products(id),
            region_id          INTEGER REFERENCES regions(id),
            country_id         INTEGER REFERENCES countries(id),
            sell_price         REAL,
            rental_price_month REAL,
            currency           TEXT NOT NULL,
            effective_date     DATE,
            UNIQUE(product_id, region_id, country_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS product_alternatives (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id             INTEGER NOT NULL REFERENCES products(id),
            alternative_product_id INTEGER NOT NULL REFERENCES products(id),
            sequence               INTEGER NOT NULL DEFAULT 1,
            UNIQUE(product_id, alternative_product_id),
            CHECK(product_id != alternative_product_id)
        )
    """)
    print("  + product_pricing / product_alternatives tables ready")

    # ------------------------------------------------------------------
    # 11. atp_rules
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS atp_rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            region_id   INTEGER REFERENCES regions(id),
            segment_id  INTEGER REFERENCES customer_segments(id),
            rule_key    TEXT NOT NULL,
            rule_value  TEXT NOT NULL,
            description TEXT
        )
    """)
    print("  + atp_rules table ready")

    # ------------------------------------------------------------------
    # 12. serial_import_batches, repair_documents, ai tables
    # ------------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS serial_import_batches (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            po_id               INTEGER NOT NULL REFERENCES purchase_orders(id),
            po_line_id          INTEGER NOT NULL REFERENCES purchase_order_lines(id),
            shipment_reference  TEXT NOT NULL,
            source_type         TEXT NOT NULL CHECK(source_type IN ('manual','ai_document','excel')),
            document_file_path  TEXT,
            status              TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Confirmed','Rejected')),
            confirmed_at        TIMESTAMP,
            imported_by_user_id INTEGER REFERENCES users(id),
            imported_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS repair_documents (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            rr_order_id         INTEGER NOT NULL REFERENCES repair_rework_orders(id),
            file_name           TEXT NOT NULL,
            file_path           TEXT NOT NULL,
            file_size_bytes     INTEGER,
            uploaded_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uploaded_by_user_id INTEGER REFERENCES users(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL REFERENCES users(id),
            session_id   TEXT NOT NULL UNIQUE,
            page_context TEXT,
            started_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at     TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ai_messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id),
            role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content         TEXT NOT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  + serial_import_batches / repair_documents / ai tables ready")

    # ------------------------------------------------------------------
    # 13. ALTER existing tables (idempotent checks)
    # ------------------------------------------------------------------
    def add_col(table, col, defn):
        existing = {row[1] for row in cur.execute(f"PRAGMA table_info({table})")}
        if col not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {defn}")
            print(f"  + {table}.{col}")
        else:
            print(f"  {table}.{col} already exists — skipped")

    add_col("locations",            "region_id",                "INTEGER REFERENCES regions(id)")
    add_col("locations",            "country_id",               "INTEGER REFERENCES countries(id)")
    add_col("customers",            "segment_id",               "INTEGER REFERENCES customer_segments(id)")
    add_col("customers",            "country_id",               "INTEGER REFERENCES countries(id)")
    add_col("products",             "latest_firmware_id",       "INTEGER REFERENCES firmware(id)")
    add_col("product_bom_components","assembly_leadtime_value", "INTEGER")
    add_col("product_bom_components","assembly_leadtime_unit",  "TEXT")
    add_col("purchase_order_lines", "price_per_product",        "REAL")
    add_col("purchase_order_lines", "price_currency",           "TEXT")
    add_col("outbound_order_lines", "fulfilling_location_id",   "INTEGER REFERENCES locations(id)")
    add_col("outbound_order_lines", "edd",                      "DATE")
    add_col("outbound_order_lines", "atp_status",               "TEXT")
    add_col("outbound_order_lines", "bom_assembly_status",      "TEXT")
    add_col("outbound_orders",      "allocation_source_order_id","INTEGER REFERENCES outbound_orders(id)")
    add_col("serial_numbers",       "firmware_id",              "INTEGER REFERENCES firmware(id)")
    add_col("serial_numbers",       "firmware_applied_at",      "TIMESTAMP")
    add_col("serial_numbers",       "pegged_to_order_id",       "INTEGER REFERENCES outbound_orders(id)")
    add_col("serial_numbers",       "import_batch_id",          "INTEGER REFERENCES serial_import_batches(id)")
    add_col("return_orders",        "rma_reference",            "TEXT")
    add_col("repair_rework_orders", "rma_reference",            "TEXT")

    # ------------------------------------------------------------------
    # 14. QUALITY_HOLD terminal state (Phase 3D — add now so DB is complete)
    # ------------------------------------------------------------------
    cur.execute("SELECT id FROM terminal_states WHERE code='QUALITY_HOLD'")
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO terminal_states (code, display_name, warehouse_type, sequence_number)
            VALUES ('QUALITY_HOLD','Quality Hold','Pre-Warehouse',2)
        """)
        print("  + terminal state QUALITY_HOLD added")
    else:
        print("  terminal state QUALITY_HOLD already exists — skipped")

    # ------------------------------------------------------------------
    # 15. RMA order numbering
    # ------------------------------------------------------------------
    cur.execute("SELECT id FROM order_numbering WHERE order_type='RMAOrder'")
    if not cur.fetchone():
        cur.execute("INSERT INTO order_numbering (order_type, prefix, padding_length, current_sequence) VALUES ('RMAOrder','RMA',6,0)")
        print("  + RMA order numbering added")
    else:
        print("  RMA order numbering already exists — skipped")

    # ------------------------------------------------------------------
    # 16. Indexes (idempotent)
    # ------------------------------------------------------------------
    indexes = [
        ("idx_user_roles_user",    "user_roles(user_id)"),
        ("idx_user_locs_user",     "user_locations(user_id)"),
        ("idx_user_regions_user",  "user_regions(user_id)"),
        ("idx_sysconfig_key",      "system_config(config_key)"),
        ("idx_sn_firmware",        "serial_numbers(firmware_id)"),
        ("idx_sn_pegged",          "serial_numbers(pegged_to_order_id)"),
        ("idx_sn_batch",           "serial_numbers(import_batch_id)"),
        ("idx_supply_flows_ver",   "supply_flows(network_version_id)"),
        ("idx_return_rma",         "return_orders(rma_reference)"),
        ("idx_rr_rma",             "repair_rework_orders(rma_reference)"),
        ("idx_ai_conv_user",       "ai_conversations(user_id)"),
        ("idx_ai_msg_conv",        "ai_messages(conversation_id)"),
        ("idx_batches_po",         "serial_import_batches(po_id)"),
    ]
    existing_indexes = {row[1] for row in cur.execute("SELECT type, name FROM sqlite_master WHERE type='index'")}
    for name, on in indexes:
        if name not in existing_indexes:
            cur.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {on}")
            print(f"  + index {name}")

    con.execute("PRAGMA foreign_keys = ON")
    con.commit()
    con.close()
    print("migrate_v23 complete.")


if __name__ == "__main__":
    run()
