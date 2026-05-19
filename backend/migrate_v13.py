"""
IMS Database Migration --- v1.2 -> v1.3
Run from C:/IMSAPP\backend: python migrate_v13.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "terminal_tracking.db"


def col_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None


def run_migration():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    print("=== IMS v1.3 Migration ===")

    # ── 1. serial_numbers --- add 10 new device identifier columns ──────────────
    print("\n[1] serial_numbers --- adding device identifier columns…")
    new_serial_cols = [
        ("lot_number",      "TEXT"),
        ("terminal_type",   "TEXT"),
        ("wifi_mac",        "TEXT"),
        ("bluetooth_mac",   "TEXT"),
        ("ethernet_mac",    "TEXT"),
        ("imei1",           "TEXT"),
        ("imei2",           "TEXT"),
        ("iccid",           "TEXT"),
        ("eid",             "TEXT"),
        ("key_id",          "TEXT"),
    ]
    for col, typ in new_serial_cols:
        if not col_exists(c, "serial_numbers", col):
            c.execute(f"ALTER TABLE serial_numbers ADD COLUMN {col} {typ}")
            print(f"  + serial_numbers.{col}")
        else:
            print(f"  ~ serial_numbers.{col} already exists")

    # ── 2. terminal_states --- add sequence + expected duration ─────────────────
    print("\n[2] terminal_states --- adding sequence/duration columns…")
    for col, typ, default in [
        ("sequence_number",         "INTEGER", None),
        ("expected_duration_value", "REAL",    None),
        ("expected_duration_unit",  "TEXT",    None),
    ]:
        if not col_exists(c, "terminal_states", col):
            c.execute(f"ALTER TABLE terminal_states ADD COLUMN {col} {typ}")
            print(f"  + terminal_states.{col}")
        else:
            print(f"  ~ terminal_states.{col} already exists")

    # Seed sequence numbers for existing default states
    state_sequences = {
        'EXPECTING':                           1,
        'QUARANTINE':                          2,
        'ENCRYPTION_KEY_LOADED':               3,
        'STAGING':                             4,
        'AVAILABLE':                           5,
        'TRANSIT_TO_COMPANY':                  6,
        'RECEIVED':                            7,
        'CUSTOMER_DELIVERY_FAILED':            8,
        'DEFECT':                              9,
        'UNDER_INVESTIGATION':                 10,
        'TRANSIT_TO_REPAIR':                   11,
        'IN_REPAIR':                           12,
        'REPAIR_DELIVERY_FAILED':              13,
        'QUARANTINE_REFURBISHED':              14,
        'AVAILABLE_REFURBISHED':               15,
        'TRANSIT_TO_WAREHOUSE':                16,
        'RECEIVED_AT_DESTINATION_WAREHOUSE':   17,
        'DESTINATION_WAREHOUSE_DELIVERY_FAILED': 18,
        'SCRAP_DESTROYED':                     19,
    }
    for code, seq in state_sequences.items():
        c.execute("UPDATE terminal_states SET sequence_number = ? WHERE code = ? AND sequence_number IS NULL",
                  (seq, code))

    # ── 3. state_history --- add new columns ────────────────────────────────────
    print("\n[3] state_history --- adding new columns…")
    for col, typ in [
        ("activity_description",     "TEXT"),
        ("order_reference",          "TEXT"),
        ("activity_cost",            "REAL"),
        ("activity_cost_currency",   "TEXT"),
        ("reporting_currency_equiv", "REAL"),
        ("exchange_rate_applied",    "REAL"),
    ]:
        if not col_exists(c, "state_history", col):
            c.execute(f"ALTER TABLE state_history ADD COLUMN {col} {typ}")
            print(f"  + state_history.{col}")
        else:
            print(f"  ~ state_history.{col} already exists")

    # ── 4. purchase_orders --- add received_date ────────────────────────────────
    print("\n[4] purchase_orders --- adding received_date…")
    for tbl, col in [("purchase_orders", "received_date"),
                     ("purchase_order_lines", "received_date"),
                     ("purchase_orders", "external_reference"),
                     ("purchase_orders", "partial_order"),
                     ("purchase_orders", "environment")]:
        if not col_exists(c, tbl, col):
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} TEXT")
            print(f"  + {tbl}.{col}")
        else:
            print(f"  ~ {tbl}.{col} already exists")

    # ── 5. outbound_orders --- add new v1.3 fields ─────────────────────────────
    print("\n[5] outbound_orders --- adding invoice/merchant fields…")
    outbound_new_cols = [
        ("order_state",           "TEXT"),
        ("merchant_reference",    "TEXT"),
        ("stock",                 "TEXT"),
        ("location_code",         "TEXT"),
        ("company_account",       "TEXT"),
        ("environment",           "TEXT"),
        ("inv_from_company",      "TEXT"),
        ("inv_from_vat_number",   "TEXT"),
        ("inv_from_reg_number",   "TEXT"),
        ("inv_from_phone",        "TEXT"),
        ("inv_from_addr_line1",   "TEXT"),
        ("inv_from_addr_line2",   "TEXT"),
        ("inv_from_addr_city",    "TEXT"),
        ("inv_from_addr_postal",  "TEXT"),
        ("inv_from_addr_state",   "TEXT"),
        ("inv_from_addr_country", "TEXT"),
        ("inv_to_company",        "TEXT"),
        ("inv_to_attention",      "TEXT"),
        ("inv_to_vat_number",     "TEXT"),
        ("inv_to_phone",          "TEXT"),
        ("inv_to_addr_line1",     "TEXT"),
        ("inv_to_addr_line2",     "TEXT"),
        ("inv_to_addr_city",      "TEXT"),
        ("inv_to_addr_postal",    "TEXT"),
        ("inv_to_addr_state",     "TEXT"),
        ("inv_to_addr_country",   "TEXT"),
        ("tracking_type",         "TEXT"),
        ("shipment_vat_number",   "TEXT"),
    ]
    for col, typ in outbound_new_cols:
        if not col_exists(c, "outbound_orders", col):
            c.execute(f"ALTER TABLE outbound_orders ADD COLUMN {col} {typ}")
            print(f"  + outbound_orders.{col}")
        else:
            print(f"  ~ outbound_orders.{col} already exists")

    # ── 6. Create new tables ──────────────────────────────────────────────────
    print("\n[6] Creating new tables…")

    # business_calendars
    if not table_exists(c, "business_calendars"):
        c.execute("""
            CREATE TABLE business_calendars (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type      TEXT NOT NULL,
                location_id      INTEGER REFERENCES locations(id),
                supplier_id      INTEGER REFERENCES suppliers(id),
                timezone         TEXT NOT NULL DEFAULT 'UTC',
                working_days     TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
                work_hours_start TEXT NOT NULL DEFAULT '08:00',
                work_hours_end   TEXT NOT NULL DEFAULT '17:00'
            )
        """)
        print("  + business_calendars")
    else:
        print("  ~ business_calendars already exists")

    # business_calendar_holidays
    if not table_exists(c, "business_calendar_holidays"):
        c.execute("""
            CREATE TABLE business_calendar_holidays (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                calendar_id  INTEGER NOT NULL REFERENCES business_calendars(id),
                holiday_date TEXT NOT NULL,
                description  TEXT,
                UNIQUE(calendar_id, holiday_date)
            )
        """)
        print("  + business_calendar_holidays")
    else:
        print("  ~ business_calendar_holidays already exists")

    # state_valid_location_types
    if not table_exists(c, "state_valid_location_types"):
        c.execute("""
            CREATE TABLE state_valid_location_types (
                state_id          INTEGER NOT NULL REFERENCES terminal_states(id),
                location_type_id  INTEGER NOT NULL REFERENCES location_types(id),
                PRIMARY KEY (state_id, location_type_id)
            )
        """)
        print("  + state_valid_location_types")
    else:
        print("  ~ state_valid_location_types already exists")

    # accessories_inventory (renamed from non_serialised_inventory)
    if not table_exists(c, "accessories_inventory"):
        c.execute("""
            CREATE TABLE accessories_inventory (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id   INTEGER NOT NULL REFERENCES products(id),
                location_id  INTEGER NOT NULL REFERENCES locations(id),
                state        TEXT NOT NULL DEFAULT 'Available',
                quantity     INTEGER NOT NULL DEFAULT 0,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(product_id, location_id, state)
            )
        """)
        print("  + accessories_inventory")
        # Migrate existing data from non_serialised_inventory
        if table_exists(c, "non_serialised_inventory"):
            c.execute("""
                INSERT OR IGNORE INTO accessories_inventory (id, product_id, location_id, state, quantity, updated_at)
                SELECT id, product_id, location_id, state, quantity, updated_at
                FROM non_serialised_inventory
            """)
            c.execute("SELECT COUNT(*) FROM accessories_inventory")
            count = c.fetchone()[0]
            print(f"  -> migrated {count} rows from non_serialised_inventory")
    else:
        print("  ~ accessories_inventory already exists")

    # distribution_orders
    if not table_exists(c, "distribution_orders"):
        c.execute("""
            CREATE TABLE distribution_orders (
                id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number             TEXT NOT NULL UNIQUE,
                distribution_reference   TEXT,
                environment              TEXT DEFAULT 'Live',
                inbound_state            TEXT,
                origin_location_id       INTEGER REFERENCES locations(id),
                destination_location_id  INTEGER REFERENCES locations(id),
                status                   TEXT NOT NULL DEFAULT 'Draft',
                shipped_at               TIMESTAMP,
                delivered_at             TIMESTAMP,
                ship_from_company        TEXT,
                ship_from_first_name     TEXT,
                ship_from_last_name      TEXT,
                ship_from_phone          TEXT,
                ship_from_email          TEXT,
                ship_from_addr_line1     TEXT,
                ship_from_addr_line2     TEXT,
                ship_from_addr_city      TEXT,
                ship_from_addr_postal    TEXT,
                ship_from_addr_state     TEXT,
                ship_from_addr_country   TEXT,
                ship_to_company          TEXT,
                ship_to_first_name       TEXT,
                ship_to_last_name        TEXT,
                ship_to_phone            TEXT,
                ship_to_email            TEXT,
                ship_to_addr_line1       TEXT,
                ship_to_addr_line2       TEXT,
                ship_to_addr_city        TEXT,
                ship_to_addr_postal      TEXT,
                ship_to_addr_state       TEXT,
                ship_to_addr_country     TEXT,
                tracking_type            TEXT,
                tracking_carrier         TEXT,
                tracking_number          TEXT,
                inbound_key              TEXT,
                inbounded_at             TIMESTAMP,
                created_by_user_id       INTEGER REFERENCES users(id),
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("  + distribution_orders")
    else:
        print("  ~ distribution_orders already exists")

    # distribution_order_lines
    if not table_exists(c, "distribution_order_lines"):
        c.execute("""
            CREATE TABLE distribution_order_lines (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
                line_id         TEXT,
                product_id      INTEGER REFERENCES products(id),
                quantity        INTEGER NOT NULL,
                stock           TEXT,
                product_state   TEXT,
                UNIQUE(dist_order_id, line_id)
            )
        """)
        print("  + distribution_order_lines")
    else:
        print("  ~ distribution_order_lines already exists")

    # distribution_order_serials
    if not table_exists(c, "distribution_order_serials"):
        c.execute("""
            CREATE TABLE distribution_order_serials (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
                shipped_line_id TEXT,
                serial_id       INTEGER REFERENCES serial_numbers(id),
                security_seal   TEXT,
                UNIQUE(dist_order_id, serial_id)
            )
        """)
        print("  + distribution_order_serials")
    else:
        print("  ~ distribution_order_serials already exists")

    # distribution_order_nonserial
    if not table_exists(c, "distribution_order_nonserial"):
        c.execute("""
            CREATE TABLE distribution_order_nonserial (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
                product_id      INTEGER REFERENCES products(id),
                quantity        INTEGER
            )
        """)
        print("  + distribution_order_nonserial")
    else:
        print("  ~ distribution_order_nonserial already exists")

    # distribution_received
    if not table_exists(c, "distribution_received"):
        c.execute("""
            CREATE TABLE distribution_received (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
                product_id      INTEGER REFERENCES products(id),
                quantity        INTEGER,
                product_state   TEXT,
                serials         TEXT
            )
        """)
        print("  + distribution_received")
    else:
        print("  ~ distribution_received already exists")

    # repair_rework_orders (replaces repair_orders)
    if not table_exists(c, "repair_rework_orders"):
        c.execute("""
            CREATE TABLE repair_rework_orders (
                id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number             TEXT NOT NULL UNIQUE,
                location_id              INTEGER REFERENCES locations(id),
                external_reference       TEXT,
                dispatch_type            TEXT NOT NULL DEFAULT 'Repair',
                reason                   TEXT,
                environment              TEXT DEFAULT 'Live',
                status                   TEXT NOT NULL DEFAULT 'Draft',
                outbound_shipped_at      TIMESTAMP,
                ship_to_first_name       TEXT,
                ship_to_last_name        TEXT,
                ship_to_company          TEXT,
                ship_to_phone            TEXT,
                ship_to_email            TEXT,
                ship_to_addr_line1       TEXT,
                ship_to_addr_city        TEXT,
                ship_to_addr_postal      TEXT,
                ship_to_addr_state       TEXT,
                ship_to_addr_country     TEXT,
                tracking_type            TEXT,
                tracking_carrier         TEXT,
                tracking_number          TEXT,
                inbound_shipped_at       TIMESTAMP,
                inbound_key              TEXT,
                inbounded_at             TIMESTAMP,
                estimated_return_date    TEXT,
                actual_return_date       TEXT,
                return_location_id       INTEGER REFERENCES locations(id),
                outcome                  TEXT,
                actual_cost              REAL,
                actual_cost_currency     TEXT,
                repair_notes             TEXT,
                created_by_user_id       INTEGER REFERENCES users(id),
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("  + repair_rework_orders")
        # Migrate from repair_orders
        if table_exists(c, "repair_orders"):
            c.execute("""
                INSERT OR IGNORE INTO repair_rework_orders
                    (id, order_number, location_id, status, estimated_return_date,
                     actual_return_date, return_location_id, outcome, actual_cost,
                     actual_cost_currency, repair_notes, created_by_user_id, created_at)
                SELECT id, order_number, repair_centre_location_id, status,
                       estimated_return_date, actual_return_date, return_location_id,
                       outcome, actual_cost, actual_cost_currency, repair_notes,
                       created_by_user_id, created_at
                FROM repair_orders
            """)
            c.execute("SELECT COUNT(*) FROM repair_rework_orders")
            count = c.fetchone()[0]
            print(f"  -> migrated {count} rows from repair_orders")
    else:
        print("  ~ repair_rework_orders already exists")

    # repair_rework_serials
    if not table_exists(c, "repair_rework_serials"):
        c.execute("""
            CREATE TABLE repair_rework_serials (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                rr_order_id     INTEGER NOT NULL REFERENCES repair_rework_orders(id),
                serial_id       INTEGER REFERENCES serial_numbers(id),
                product_code    TEXT,
                UNIQUE(rr_order_id, serial_id)
            )
        """)
        print("  + repair_rework_serials")
        # Migrate from repair_order_serials
        if table_exists(c, "repair_order_serials"):
            c.execute("""
                INSERT OR IGNORE INTO repair_rework_serials (id, rr_order_id, serial_id)
                SELECT id, repair_order_id, serial_id FROM repair_order_serials
            """)
            c.execute("SELECT COUNT(*) FROM repair_rework_serials")
            count = c.fetchone()[0]
            print(f"  -> migrated {count} rows from repair_order_serials")
    else:
        print("  ~ repair_rework_serials already exists")

    # repair_rework_received
    if not table_exists(c, "repair_rework_received"):
        c.execute("""
            CREATE TABLE repair_rework_received (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                rr_order_id     INTEGER NOT NULL REFERENCES repair_rework_orders(id),
                product_id      INTEGER REFERENCES products(id),
                quantity        INTEGER,
                product_state   TEXT,
                serials         TEXT
            )
        """)
        print("  + repair_rework_received")
    else:
        print("  ~ repair_rework_received already exists")

    # outbound_order_nonserial
    if not table_exists(c, "outbound_order_nonserial"):
        c.execute("""
            CREATE TABLE outbound_order_nonserial (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id       INTEGER NOT NULL REFERENCES outbound_orders(id),
                order_line_id  INTEGER NOT NULL REFERENCES outbound_order_lines(id),
                product_id     INTEGER REFERENCES products(id),
                quantity       INTEGER,
                UNIQUE(order_id, order_line_id, product_id)
            )
        """)
        print("  + outbound_order_nonserial")
    else:
        print("  ~ outbound_order_nonserial already exists")

    # outbound_order_serials --- add iccid, security_seal, shipped_line_id if missing
    for col in [("shipped_line_id", "TEXT"), ("security_seal", "TEXT"), ("iccid", "TEXT")]:
        if not col_exists(c, "outbound_order_serials", col[0]):
            c.execute(f"ALTER TABLE outbound_order_serials ADD COLUMN {col[0]} {col[1]}")
            print(f"  + outbound_order_serials.{col[0]}")

    # outbound_order_lines --- add group_id, line_id if missing
    for col in [("line_id", "TEXT"), ("group_id", "TEXT")]:
        if not col_exists(c, "outbound_order_lines", col[0]):
            c.execute(f"ALTER TABLE outbound_order_lines ADD COLUMN {col[0]} {col[1]}")
            print(f"  + outbound_order_lines.{col[0]}")

    # ── 7. Add missing order_numbering rows ───────────────────────────────────
    print("\n[7] Ensuring order_numbering rows…")
    for order_type, prefix in [
        ('PurchaseOrder',    'PO'),
        ('SalesOrder',       'SO'),
        ('ReturnOrder',      'RE'),
        ('RentalOrder',      'RN'),
        ('ReplacementOrder', 'RP'),
        ('DistributionOrder','DS'),
        ('RepairReworkOrder','RR'),
    ]:
        c.execute("SELECT id FROM order_numbering WHERE order_type = ?", (order_type,))
        if not c.fetchone():
            c.execute("INSERT INTO order_numbering (order_type, prefix) VALUES (?, ?)",
                      (order_type, prefix))
            print(f"  + {order_type} ({prefix})")
        else:
            print(f"  ~ {order_type} already exists")

    # ── 8. Create new indexes ─────────────────────────────────────────────────
    print("\n[8] Creating new indexes…")
    indexes = [
        ("idx_serial_iccid",  "CREATE INDEX IF NOT EXISTS idx_serial_iccid ON serial_numbers(iccid)"),
        ("idx_serial_imei1",  "CREATE INDEX IF NOT EXISTS idx_serial_imei1 ON serial_numbers(imei1)"),
        ("idx_serial_lot",    "CREATE INDEX IF NOT EXISTS idx_serial_lot ON serial_numbers(lot_number)"),
        ("idx_dist_status",   "CREATE INDEX IF NOT EXISTS idx_dist_status ON distribution_orders(status)"),
        ("idx_rr_status",     "CREATE INDEX IF NOT EXISTS idx_rr_status ON repair_rework_orders(status)"),
    ]
    for name, sql in indexes:
        try:
            c.execute(sql)
            print(f"  + {name}")
        except Exception as e:
            print(f"  ~ {name}: {e}")

    conn.commit()
    conn.close()
    print("\n=== Migration complete ===")


if __name__ == "__main__":
    run_migration()
