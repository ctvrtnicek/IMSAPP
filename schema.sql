-- =============================================================================
-- INVENTORY MANAGEMENT SYSTEM (IMS) — DATABASE SCHEMA
-- Version: 2.1 | May 2026
-- Database: SQLite (compatible with PostgreSQL via SQLAlchemy)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT NOT NULL UNIQUE,
    email                TEXT UNIQUE,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL CHECK(role IN (
                             'admin','supply_planner','warehouse_user',
                             'repair_centre','supplier')),
    default_location_id  INTEGER REFERENCES locations(id),
    active               INTEGER NOT NULL DEFAULT 1,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — LOCATION TYPES (configurable by admin)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE location_types (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL UNIQUE,  -- Warehouse, FSL, Repair Centre, Supplier
    active INTEGER NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — LOCATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE locations (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    code                 TEXT NOT NULL UNIQUE,
    name                 TEXT NOT NULL,
    location_type_id     INTEGER NOT NULL REFERENCES location_types(id),
    country              TEXT NOT NULL,
    city                 TEXT,
    reporting_currency   TEXT NOT NULL DEFAULT 'EUR',
    active               INTEGER NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — BUSINESS CALENDARS (per location or per supplier)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE business_calendars (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type      TEXT NOT NULL CHECK(entity_type IN ('location','supplier')),
    location_id      INTEGER REFERENCES locations(id),
    supplier_id      INTEGER REFERENCES suppliers(id),
    timezone         TEXT NOT NULL DEFAULT 'UTC',  -- IANA e.g. Europe/Amsterdam
    working_days     TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',  -- comma-separated
    work_hours_start TEXT NOT NULL DEFAULT '08:00',  -- HH:MM local time
    work_hours_end   TEXT NOT NULL DEFAULT '17:00',
    CHECK((location_id IS NOT NULL) OR (supplier_id IS NOT NULL))
);

CREATE TABLE business_calendar_holidays (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_id  INTEGER NOT NULL REFERENCES business_calendars(id),
    holiday_date DATE NOT NULL,
    description  TEXT,
    UNIQUE(calendar_id, holiday_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — TRANSIT TIME LANES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE transit_time_lanes (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    from_location_id     INTEGER NOT NULL REFERENCES locations(id),
    to_location_id       INTEGER NOT NULL REFERENCES locations(id),
    transport_mode       TEXT NOT NULL CHECK(transport_mode IN ('Air','Sea','Road')),
    lead_time_days       INTEGER NOT NULL,
    UNIQUE(from_location_id, to_location_id, transport_mode)
);

CREATE TABLE transit_time_fallback (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_time_days   INTEGER NOT NULL DEFAULT 14
);
INSERT INTO transit_time_fallback (lead_time_days) VALUES (14);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — ASSEMBLY TIMES (kit consolidation per location)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE assembly_times (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id     INTEGER NOT NULL REFERENCES locations(id) UNIQUE,
    duration_days   INTEGER NOT NULL DEFAULT 2
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — SUPPLIERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    country         TEXT NOT NULL,
    city            TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE supplier_users (
    user_id      INTEGER NOT NULL REFERENCES users(id),
    supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
    PRIMARY KEY (user_id, supplier_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — PRODUCTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE products (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    code                   TEXT NOT NULL UNIQUE,       -- API: id / Part#
    name                   TEXT NOT NULL,              -- API: description
    product_type           TEXT NOT NULL CHECK(product_type IN
                               ('Payment Terminal','Accessory','Battery')),
    product_category       TEXT NOT NULL CHECK(product_category IN
                               ('PaymentDevice','SerializedAccessory','Accessory')),
    serialised             INTEGER NOT NULL DEFAULT 0, -- API: characteristic_serialised
    vendor_keyloaded       INTEGER NOT NULL DEFAULT 0, -- API: characteristic_vendorKeyloaded
    is_bom                 INTEGER NOT NULL DEFAULT 0,
    unit_value             REAL,
    unit_currency          TEXT DEFAULT 'EUR',
    unit_value_symbol      TEXT,                       -- API: unitValue_symbol e.g. $
    unit_value_decimals    INTEGER DEFAULT 2,          -- API: unitValue_decimals
    unit_value_display     TEXT,                       -- API: unitValue_displayValue e.g. $22.40
    refurb_unit_value      REAL,
    refurb_unit_currency   TEXT,
    hs_code                TEXT,
    updated_at             TIMESTAMP,                  -- API: updatedAt
    active                 INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE product_bom_components (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_product_id     INTEGER NOT NULL REFERENCES products(id),
    component_product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity              INTEGER NOT NULL DEFAULT 1,
    UNIQUE(parent_product_id, component_product_id),
    CHECK(parent_product_id != component_product_id)
);

CREATE TABLE product_suppliers (
    product_id   INTEGER NOT NULL REFERENCES products(id),
    supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
    PRIMARY KEY (product_id, supplier_id)
);

CREATE TABLE product_repair_centres (
    product_id   INTEGER NOT NULL REFERENCES products(id),
    location_id  INTEGER NOT NULL REFERENCES locations(id),
    PRIMARY KEY (product_id, location_id)
);

CREATE TABLE product_countries (
    product_id    INTEGER NOT NULL REFERENCES products(id),
    country_code  TEXT NOT NULL,  -- ISO 3166-1 alpha-2, API: regions
    PRIMARY KEY (product_id, country_code)
);

CREATE TABLE product_interchangeable (
    product_id                 INTEGER NOT NULL REFERENCES products(id),
    interchangeable_product_id INTEGER NOT NULL REFERENCES products(id),
    PRIMARY KEY (product_id, interchangeable_product_id),
    CHECK(product_id != interchangeable_product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — CUSTOMERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE customers (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_ref      TEXT NOT NULL UNIQUE,
    duns_number       TEXT,
    name              TEXT NOT NULL,
    customer_type     TEXT NOT NULL CHECK(customer_type IN
                          ('Shop','Merchant','Distributor','Partner')),
    country           TEXT NOT NULL,
    state_region      TEXT,
    credit_rating     TEXT,
    delivery_address  TEXT,
    contact_email     TEXT,
    contact_phone     TEXT,
    active            INTEGER NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — TERMINAL STATES (configurable, enhanced v1.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE terminal_states (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    code                     TEXT NOT NULL UNIQUE,
    display_name             TEXT NOT NULL,
    warehouse_type           TEXT,  -- Live, RefurbishedLive, Out-Warehouse, Pre-Warehouse, End State
    sequence_number          INTEGER,  -- informational lifecycle order
    expected_duration_value  REAL,     -- numeric duration (e.g. 2)
    expected_duration_unit   TEXT CHECK(expected_duration_unit IN ('Hours','Days')),
    description              TEXT,
    active                   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE state_valid_location_types (
    state_id          INTEGER NOT NULL REFERENCES terminal_states(id),
    location_type_id  INTEGER NOT NULL REFERENCES location_types(id),
    PRIMARY KEY (state_id, location_type_id)
);

CREATE TABLE state_transitions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    from_state_id INTEGER REFERENCES terminal_states(id),  -- NULL = initial state
    to_state_id   INTEGER NOT NULL REFERENCES terminal_states(id),
    acting_role   TEXT NOT NULL,
    UNIQUE(from_state_id, to_state_id, acting_role)
);

-- Default states (sequence + expected duration)
INSERT INTO terminal_states (code, display_name, warehouse_type, sequence_number,
    expected_duration_value, expected_duration_unit) VALUES
    ('EXPECTING',                           'In Transit (Inbound)',       'Pre-Warehouse',     1,  NULL, NULL),
    ('QUARANTINE',                          'Quarantine',                 'Live',              2,  1,    'Days'),
    ('ENCRYPTION_KEY_LOADED',              'Key Loaded',                 'Live',              3,  4,    'Hours'),
    ('STAGING',                             'Staging',                    'Live',              4,  2,    'Days'),
    ('AVAILABLE',                           'Available',                  'Live',              5,  NULL, NULL),
    ('TRANSIT_TO_COMPANY',                  'In Transit (Outbound)',       'Out-Warehouse',     6,  NULL, NULL),
    ('RECEIVED',                            'Received by Customer',       'Out-Warehouse',     7,  NULL, NULL),
    ('CUSTOMER_DELIVERY_FAILED',            'Delivery Failed',            'Out-Warehouse',     8,  NULL, NULL),
    ('DEFECT',                              'Defect',                     'ReturnedLive',      9,  NULL, NULL),
    ('UNDER_INVESTIGATION',                 'Under Investigation',        'ReturnedLive',      10, 2,    'Days'),
    ('TRANSIT_TO_REPAIR',                   'In Transit (to Repair)',     'Out-Warehouse',     11, NULL, NULL),
    ('IN_REPAIR',                           'In Repair',                  'Out-Warehouse',     12, 5,    'Days'),
    ('REPAIR_DELIVERY_FAILED',              'Repair Delivery Failed',     'Out-Warehouse',     13, NULL, NULL),
    ('QUARANTINE_REFURBISHED',             'Quarantine (Refurbished)',   'RefurbishedLive',   14, 1,    'Days'),
    ('AVAILABLE_REFURBISHED',              'Available (Refurbished)',    'RefurbishedLive',   15, NULL, NULL),
    ('TRANSIT_TO_WAREHOUSE',               'In Transit (to Warehouse)',  'Out-Warehouse',     16, NULL, NULL),
    ('RECEIVED_AT_DESTINATION_WAREHOUSE',  'Received at Destination',    'Out-Warehouse',     17, NULL, NULL),
    ('DESTINATION_WAREHOUSE_DELIVERY_FAILED', 'Warehouse Delivery Failed','Out-Warehouse',    18, NULL, NULL),
    ('SCRAP_DESTROYED',                    'Scrap / Destroyed',          'End State',         19, NULL, NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — ACTIVITY COSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE activity_costs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id  INTEGER NOT NULL REFERENCES locations(id),
    state_id     INTEGER NOT NULL REFERENCES terminal_states(id),
    product_id   INTEGER REFERENCES products(id),  -- NULL = all products
    amount       REAL NOT NULL,
    currency     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — EXCHANGE RATES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE exchange_rates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency   TEXT NOT NULL,
    to_currency     TEXT NOT NULL,
    rate            REAL NOT NULL,
    effective_date  DATE NOT NULL,
    UNIQUE(from_currency, to_currency, effective_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER DATA — ORDER NUMBERING
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE order_numbering (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_type       TEXT NOT NULL UNIQUE,
    prefix           TEXT NOT NULL,
    padding_length   INTEGER NOT NULL DEFAULT 6,
    current_sequence INTEGER NOT NULL DEFAULT 0
);

INSERT INTO order_numbering (order_type, prefix) VALUES
    ('PurchaseOrder','PO'), ('SalesOrder','SO'), ('ReturnOrder','RE'),
    ('RentalOrder','RN'), ('ReplacementOrder','RP'),
    ('DistributionOrder','DS'), ('RepairReworkOrder','RR');

-- ─────────────────────────────────────────────────────────────────────────────
-- INVENTORY — SERIAL NUMBERS (enhanced v1.3 with device identifiers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE serial_numbers (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Core identifiers
    serial_number        TEXT NOT NULL,                -- API: Serial #
    supplier_id          INTEGER NOT NULL REFERENCES suppliers(id),
    product_id           INTEGER NOT NULL REFERENCES products(id),
    -- Device identifiers (from Terminals_receiving-Sample.xls)
    lot_number           TEXT,                         -- API: Lot#  (batch identifier)
    terminal_type        TEXT,                         -- API: Type  (full model string)
    wifi_mac             TEXT,                         -- API: WIFI MAC
    bluetooth_mac        TEXT,                         -- API: BT MAC
    ethernet_mac         TEXT,                         -- API: ETHERNET MAC
    imei1                TEXT,                         -- API: IMEI 1
    imei2                TEXT,                         -- API: IMEI 2 (dual SIM)
    iccid                TEXT,                         -- API: ICCID (SIM card ID)
    eid                  TEXT,                         -- API: EID (eSIM identifier)
    key_id               TEXT,                         -- API: Key ID (encryption key ref)
    -- State & location
    current_state_id     INTEGER REFERENCES terminal_states(id),
    current_location_id  INTEGER REFERENCES locations(id),
    stock_type           TEXT NOT NULL DEFAULT 'Live'
                         CHECK(stock_type IN ('Live','Refurbished','Returned','Test')),
    security_seal        INTEGER DEFAULT 0,
    key_loaded           INTEGER DEFAULT 0,
    -- Order references
    po_id                INTEGER REFERENCES purchase_orders(id),
    po_line_id           INTEGER REFERENCES purchase_order_lines(id),
    -- Cost
    accumulated_cost     REAL DEFAULT 0,
    -- Status
    active               INTEGER NOT NULL DEFAULT 1,   -- 0 = SCRAP/DESTROYED
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(serial_number, supplier_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVENTORY — STATE HISTORY (immutable audit, 1:N per serial, enhanced v1.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE state_history (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number_id            INTEGER NOT NULL REFERENCES serial_numbers(id),
    state_id                    INTEGER NOT NULL REFERENCES terminal_states(id),
    location_id                 INTEGER REFERENCES locations(id),
    datetime_utc                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timezone                    TEXT NOT NULL DEFAULT 'UTC',
    actor_type                  TEXT NOT NULL CHECK(actor_type IN ('user','api','system')),
    actor_user_id               INTEGER REFERENCES users(id),
    activity_description        TEXT,  -- verbose human-readable description
    order_reference             TEXT,  -- PO/SO/DS/RR/RE order ID for hyperlink
    activity_cost               REAL,  -- raw cost in native currency
    activity_cost_currency      TEXT,
    reporting_currency_equiv    REAL,  -- converted amount in location reporting currency
    exchange_rate_applied       REAL,  -- rate used for conversion
    notes                       TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVENTORY — ACCESSORIES (non-serialised, renamed in UI)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE accessories_inventory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   INTEGER NOT NULL REFERENCES products(id),
    location_id  INTEGER NOT NULL REFERENCES locations(id),
    state        TEXT NOT NULL DEFAULT 'Available'
                 CHECK(state IN ('Received','Available')),
    quantity     INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, location_id, state)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INBOUND — PURCHASE ORDERS (enhanced v1.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE purchase_orders (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number               TEXT NOT NULL UNIQUE,          -- internal e.g. PO000001
    external_reference      TEXT,                          -- API: reference e.g. AU00000320
    supplier_id             INTEGER NOT NULL REFERENCES suppliers(id),
    destination_location_id INTEGER NOT NULL REFERENCES locations(id),
    order_date              DATE NOT NULL,
    expected_arrival_date   DATE,
    partial_order           INTEGER DEFAULT 0,             -- API: partialOrder boolean
    environment             TEXT DEFAULT 'Live'
                            CHECK(environment IN ('Live','Test')),
    status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK(status IN ('Draft','Issued','Expected',
                                'Partially Received','Fully Received','Closed','Cancelled')),
    received_date           DATE,                          -- auto-populated on first receipt
    notes                   TEXT,
    created_by_user_id      INTEGER REFERENCES users(id),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_order_lines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id            INTEGER NOT NULL REFERENCES purchase_orders(id),
    line_number      INTEGER NOT NULL,
    product_id       INTEGER NOT NULL REFERENCES products(id),
    qty_ordered      INTEGER NOT NULL,
    qty_expected     INTEGER NOT NULL DEFAULT 0,
    qty_received     INTEGER NOT NULL DEFAULT 0,
    received_date    DATE,                          -- per-line received date (v1.3)
    UNIQUE(po_id, line_number)
);

CREATE TABLE inbound_shipments (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id                   INTEGER NOT NULL REFERENCES purchase_orders(id),
    shipment_reference      TEXT,
    carrier                 TEXT,
    carrier_tracking_ref    TEXT,
    estimated_arrival_date  DATE,
    uploaded_by_user_id     INTEGER REFERENCES users(id),
    uploaded_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- OUTBOUND ORDERS — SALES (SO), RENTAL (RN), REPLACEMENT (RP) — enhanced v1.3
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE outbound_orders (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number            TEXT NOT NULL UNIQUE,
    order_type              TEXT NOT NULL CHECK(order_type IN
                                ('Sales','Rental','Replacement','Distribution')),
    status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK(status IN ('Draft','Issued','Allocated',
                                'In Picking','Shipped','Delivered','Closed',
                                'Delivery Failed','Cancelled')),
    -- API fields from sales_orders.xlsx
    order_state             TEXT,                  -- API: orderState
    merchant_reference      TEXT,                  -- API: merchantReference
    stock                   TEXT,                  -- API: stock e.g. LiveRefurbished
    location_code           TEXT,                  -- API: location (fulfilling warehouse)
    company_account         TEXT,                  -- API: companyAccount
    environment             TEXT DEFAULT 'Live',
    -- InvoicedFrom (from sales_orders.xlsx)
    inv_from_company        TEXT,
    inv_from_vat_number     TEXT,
    inv_from_reg_number     TEXT,
    inv_from_phone          TEXT,
    inv_from_addr_line1     TEXT,
    inv_from_addr_line2     TEXT,
    inv_from_addr_city      TEXT,
    inv_from_addr_postal    TEXT,
    inv_from_addr_state     TEXT,
    inv_from_addr_country   TEXT,
    -- InvoicedTo
    inv_to_company          TEXT,
    inv_to_attention        TEXT,
    inv_to_vat_number       TEXT,
    inv_to_phone            TEXT,
    inv_to_addr_line1       TEXT,
    inv_to_addr_line2       TEXT,
    inv_to_addr_city        TEXT,
    inv_to_addr_postal      TEXT,
    inv_to_addr_state       TEXT,
    inv_to_addr_country     TEXT,
    -- Customer / destination
    customer_id             INTEGER REFERENCES customers(id),
    destination_location_id INTEGER REFERENCES locations(id),  -- for Distribution
    -- ATP
    atp_ship_date           DATE,
    atp_delivery_date       DATE,
    atp_feasible            INTEGER DEFAULT 1,
    fulfilling_location_id  INTEGER REFERENCES locations(id),
    -- Shipment
    carrier                 TEXT,
    tracking_number         TEXT,
    tracking_type           TEXT,
    shipped_date            DATE,
    estimated_arrival_date  DATE,
    shipping_cost           REAL,
    shipping_cost_currency  TEXT,
    shipment_vat_number     TEXT,
    -- Rental
    rental_period_months    INTEGER,
    rental_fee              REAL,
    rental_fee_currency     TEXT,
    rental_expected_return_date DATE,
    -- Links
    linked_return_order_id  INTEGER REFERENCES return_orders(id),
    created_by_user_id      INTEGER REFERENCES users(id),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE outbound_order_lines (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL REFERENCES outbound_orders(id),
    line_number   INTEGER NOT NULL,
    line_id       TEXT,                   -- API: ordLine_id
    product_id    INTEGER NOT NULL REFERENCES products(id),
    quantity      INTEGER NOT NULL,
    group_id      TEXT,                   -- API: ordLine_groupId
    UNIQUE(order_id, line_number)
);

CREATE TABLE outbound_order_serials (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER NOT NULL REFERENCES outbound_orders(id),
    order_line_id  INTEGER NOT NULL REFERENCES outbound_order_lines(id),
    serial_id      INTEGER NOT NULL REFERENCES serial_numbers(id),
    shipped_line_id TEXT,                 -- API: shippedLine_id
    security_seal  TEXT,                  -- API: shipped_securitySeal
    iccid          TEXT,                  -- API: shipped_iccid (SIM card on this shipment)
    UNIQUE(order_id, serial_id)
);

CREATE TABLE outbound_order_nonserial (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER NOT NULL REFERENCES outbound_orders(id),
    order_line_id  INTEGER NOT NULL REFERENCES outbound_order_lines(id),
    product_id     INTEGER REFERENCES products(id),  -- API: shipped_nonSerial_product
    quantity       INTEGER,                           -- API: shipped_nonSerial_quantity
    UNIQUE(order_id, order_line_id, product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DISTRIBUTION ORDERS (DS) — using distribution_inbound/outbound structure
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE distribution_orders (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number             TEXT NOT NULL UNIQUE,         -- DSxxxxxx
    distribution_reference   TEXT,                         -- API: distributionReference
    environment              TEXT DEFAULT 'Live',
    inbound_state            TEXT,                         -- API: inboundState e.g. Confirmed
    origin_location_id       INTEGER REFERENCES locations(id),
    destination_location_id  INTEGER REFERENCES locations(id),
    status                   TEXT NOT NULL DEFAULT 'Draft'
                             CHECK(status IN ('Draft','Issued','Shipped',
                                 'Delivered','Closed','Cancelled')),
    -- Shipment dates
    shipped_at               TIMESTAMP,
    delivered_at             TIMESTAMP,
    -- Ship From
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
    -- Ship To
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
    -- Tracking
    tracking_type            TEXT,
    tracking_carrier         TEXT,
    tracking_number          TEXT,
    -- Inbound record
    inbound_key              TEXT,
    inbounded_at             TIMESTAMP,
    created_by_user_id       INTEGER REFERENCES users(id),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE distribution_order_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
    line_id         TEXT,                      -- API: distLine_id
    product_id      INTEGER REFERENCES products(id),
    quantity        INTEGER NOT NULL,
    stock           TEXT,                      -- API: distLine_stock
    product_state   TEXT,                      -- API: distLine_productState
    UNIQUE(dist_order_id, line_id)
);

CREATE TABLE distribution_order_serials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
    shipped_line_id TEXT,
    serial_id       INTEGER REFERENCES serial_numbers(id),
    security_seal   TEXT,
    UNIQUE(dist_order_id, serial_id)
);

CREATE TABLE distribution_order_nonserial (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
    product_id      INTEGER REFERENCES products(id),
    quantity        INTEGER
);

CREATE TABLE distribution_received (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dist_order_id   INTEGER NOT NULL REFERENCES distribution_orders(id),
    product_id      INTEGER REFERENCES products(id),
    quantity        INTEGER,
    product_state   TEXT,
    serials         TEXT                        -- comma-separated serial numbers
);

-- ─────────────────────────────────────────────────────────────────────────────
-- REPAIR & REWORK ORDERS (RR) — replaces repair_orders from v1.2
-- Source: dispatches_outbound.xlsx + dispatches_inbound.xlsx
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE repair_rework_orders (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number             TEXT NOT NULL UNIQUE,  -- RRxxxxxx
    location_id              INTEGER REFERENCES locations(id),  -- originating warehouse
    external_reference       TEXT,                  -- API: reference e.g. RMA_111/26
    dispatch_type            TEXT NOT NULL CHECK(dispatch_type IN ('Repair','Rework')),
    reason                   TEXT,                  -- API: reason free text
    environment              TEXT DEFAULT 'Live',
    status                   TEXT NOT NULL DEFAULT 'Draft'
                             CHECK(status IN ('Draft','Dispatched',
                                 'Received at Repair Centre','In Repair',
                                 'Completed','Returned','Closed')),
    -- Outbound (to repair/rework shop)
    outbound_shipped_at      TIMESTAMP,             -- API: outbound_shippedAt
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
    -- Inbound (return from repair/rework)
    inbound_shipped_at       TIMESTAMP,             -- API: shipment_shippedAt
    inbound_key              TEXT,                  -- API: inbound_inboundKey
    inbounded_at             TIMESTAMP,             -- API: inbound_inboundedAt
    estimated_return_date    DATE,
    actual_return_date       DATE,
    return_location_id       INTEGER REFERENCES locations(id),  -- default = originating
    -- Outcome & cost
    outcome                  TEXT CHECK(outcome IN ('Repaired','Beyond Repair')),
    actual_cost              REAL,
    actual_cost_currency     TEXT,
    repair_notes             TEXT,
    created_by_user_id       INTEGER REFERENCES users(id),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repair_rework_serials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rr_order_id     INTEGER NOT NULL REFERENCES repair_rework_orders(id),
    serial_id       INTEGER REFERENCES serial_numbers(id),
    product_code    TEXT,                  -- API: shipped_productCode (if serial not resolved)
    UNIQUE(rr_order_id, serial_id)
);

CREATE TABLE repair_rework_received (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rr_order_id     INTEGER NOT NULL REFERENCES repair_rework_orders(id),
    product_id      INTEGER REFERENCES products(id),
    quantity        INTEGER,
    product_state   TEXT,
    serials         TEXT                   -- comma-separated
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RETURN ORDERS (RE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE return_orders (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number                TEXT NOT NULL UNIQUE,
    original_order_id           INTEGER REFERENCES outbound_orders(id),
    customer_id                 INTEGER REFERENCES customers(id),
    reason                      TEXT NOT NULL CHECK(reason IN (
                                    'Defective','End of Rental','End of Lifecycle',
                                    'Wrong Item','Other')),
    status                      TEXT NOT NULL DEFAULT 'Initiated'
                                CHECK(status IN ('Initiated','In Transit','Received',
                                    'Inspected','Closed')),
    inspection_outcome          TEXT CHECK(inspection_outcome IN ('Defective','Scrap')),
    linked_replacement_order_id INTEGER REFERENCES outbound_orders(id),
    linked_rr_order_id          INTEGER REFERENCES repair_rework_orders(id),
    created_by_user_id          INTEGER REFERENCES users(id),
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE return_order_serials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    return_order_id INTEGER NOT NULL REFERENCES return_orders(id),
    serial_id       INTEGER NOT NULL REFERENCES serial_numbers(id),
    UNIQUE(return_order_id, serial_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASS UPLOAD LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE mass_upload_log (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_type          TEXT NOT NULL,
    uploaded_by_user_id  INTEGER REFERENCES users(id),
    filename             TEXT,
    total_records        INTEGER NOT NULL DEFAULT 0,
    successful_records   INTEGER NOT NULL DEFAULT 0,
    failed_records       INTEGER NOT NULL DEFAULT 0,
    error_report         TEXT,
    uploaded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_serial_state       ON serial_numbers(current_state_id);
CREATE INDEX idx_serial_location    ON serial_numbers(current_location_id);
CREATE INDEX idx_serial_product     ON serial_numbers(product_id);
CREATE INDEX idx_serial_supplier    ON serial_numbers(supplier_id);
CREATE INDEX idx_serial_iccid       ON serial_numbers(iccid);
CREATE INDEX idx_serial_imei1       ON serial_numbers(imei1);
CREATE INDEX idx_serial_lot         ON serial_numbers(lot_number);
CREATE INDEX idx_history_serial     ON state_history(serial_number_id);
CREATE INDEX idx_history_datetime   ON state_history(datetime_utc);
CREATE INDEX idx_po_supplier        ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status          ON purchase_orders(status);
CREATE INDEX idx_order_type_status  ON outbound_orders(order_type, status);
CREATE INDEX idx_order_customer     ON outbound_orders(customer_id);
CREATE INDEX idx_dist_status        ON distribution_orders(status);
CREATE INDEX idx_rr_status          ON repair_rework_orders(status);
CREATE INDEX idx_return_status      ON return_orders(status);

-- =============================================================================
-- RELEASE 3 ADDITIONS  |  IMS Schema v2.1  |  May 2026
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — REGIONS & COUNTRIES (global market coverage)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE regions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    region_code  TEXT NOT NULL UNIQUE,   -- EMEA, APAC, NA, SA
    region_name  TEXT NOT NULL,
    active       INTEGER NOT NULL DEFAULT 1
);
INSERT INTO regions (region_code, region_name) VALUES
    ('EMEA','Europe Middle East & Africa'),
    ('APAC','Asia Pacific'),
    ('NA','North America'),
    ('SA','South America');

CREATE TABLE countries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code  TEXT NOT NULL UNIQUE,  -- ISO 3166-1 alpha-2
    country_name  TEXT NOT NULL,
    region_id     INTEGER NOT NULL REFERENCES regions(id),
    serviced      INTEGER NOT NULL DEFAULT 0,  -- 1 = activated serviced market
    activated_at  TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — NETWORK VERSIONS (baseline + simulation planning)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE network_versions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    version_name     TEXT NOT NULL,
    version_type     TEXT NOT NULL CHECK(version_type IN ('baseline','simulation')),
    reference_number TEXT,
    effective_date   DATE,
    committed_at     TIMESTAMP,
    committed_by_user_id INTEGER REFERENCES users(id),
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — SUPPLY FLOWS & FLOW CONSTRAINTS (network configuration)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE supply_flows (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    network_version_id  INTEGER NOT NULL REFERENCES network_versions(id),
    from_location_id    INTEGER NOT NULL REFERENCES locations(id),
    to_location_id      INTEGER NOT NULL REFERENCES locations(id),
    flow_type           TEXT NOT NULL CHECK(flow_type IN ('A','B','C','D','E','F','G','H','I')),
    -- A=Supplier->WH, B=WH->FSL, C=WH->WH, D=WH->Repair, E=Repair->WH,
    -- F=Repair->FSL, G=WH->Customer, H=FSL->Customer, I=Customer->WH
    active              INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE flow_constraints (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id              INTEGER NOT NULL REFERENCES supply_flows(id),
    product_id           INTEGER REFERENCES products(id),       -- NULL = all products
    replenishment_type   TEXT,                                  -- NULL = all types
    valid_from           DATE,
    valid_to             DATE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — CUSTOMER SEGMENTS (demand segmentation for ATP rules)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE customer_segments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    segment_code   TEXT NOT NULL UNIQUE,
    segment_name   TEXT NOT NULL,
    priority       INTEGER NOT NULL DEFAULT 99  -- lower = higher priority
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — FIRMWARE MASTER (device version control)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE firmware (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    firmware_name    TEXT NOT NULL,
    version          TEXT NOT NULL,
    release_number   TEXT,
    release_date     DATE,
    release_hour     TEXT,               -- HH:MM
    key_used         TEXT,               -- encryption key reference
    file_path        TEXT,               -- uploaded firmware binary path
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(firmware_name, version, release_number)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — PRODUCT PRICING (regional & country-level pricing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE product_pricing (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id              INTEGER NOT NULL REFERENCES products(id),
    region_id               INTEGER REFERENCES regions(id),   -- NULL = all regions in country
    country_id              INTEGER REFERENCES countries(id), -- NULL = whole region
    sell_price              REAL,
    rental_price_month      REAL,
    currency                TEXT NOT NULL,
    effective_date          DATE,
    UNIQUE(product_id, region_id, country_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — PRODUCT ALTERNATIVES (substitution management)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE product_alternatives (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id               INTEGER NOT NULL REFERENCES products(id),
    alternative_product_id   INTEGER NOT NULL REFERENCES products(id),
    sequence                 INTEGER NOT NULL DEFAULT 1,
    UNIQUE(product_id, alternative_product_id),
    CHECK(product_id != alternative_product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — ATP RULES (configurable per region and customer segment)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE atp_rules (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id     INTEGER REFERENCES regions(id),            -- NULL = global
    segment_id    INTEGER REFERENCES customer_segments(id),  -- NULL = all segments
    rule_key      TEXT NOT NULL,   -- e.g. LOOKAHEAD_DAYS, ALLOW_CROSS_REGION
    rule_value    TEXT NOT NULL,
    description   TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — USER ROLES & LOCATION/REGION SCOPING (multi-role + data access)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_roles (
    user_id      INTEGER NOT NULL REFERENCES users(id),
    role_code    TEXT NOT NULL,   -- admin, supply_planner, warehouse_user, etc.
    assigned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE user_locations (
    user_id      INTEGER NOT NULL REFERENCES users(id),
    location_id  INTEGER NOT NULL REFERENCES locations(id),
    PRIMARY KEY (user_id, location_id)
);

CREATE TABLE user_regions (
    user_id    INTEGER NOT NULL REFERENCES users(id),
    region_id  INTEGER NOT NULL REFERENCES regions(id),
    PRIMARY KEY (user_id, region_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — SYSTEM CONFIG (centralised admin-managed parameters)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE system_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key      TEXT NOT NULL UNIQUE,
    label           TEXT NOT NULL,
    description     TEXT,
    data_type       TEXT NOT NULL CHECK(data_type IN ('string','integer','boolean','decimal')),
    current_value   TEXT,
    default_value   TEXT,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id INTEGER REFERENCES users(id)
);
INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value) VALUES
    ('AI_ASSISTANT_ENABLED',            'AI Assistant Enabled',               'Show AI assistant chat panel in navigation bar',                   'boolean', '0',  '0'),
    ('ANTHROPIC_API_KEY',               'Anthropic API Key',                  'API key for Claude AI assistant and document processor (masked)',  'string',  '',   ''),
    ('ATP_REALLOCATION_LOOKBACK_DAYS',  'ATP Reallocation Look-back Days',    'Maximum days back for outbound order reallocation eligibility',    'integer', '30', '30'),
    ('AI_DOCUMENT_PROCESSOR_ENABLED',   'AI Document Processor Enabled',      'Enable AI extraction for supplier document uploads on PO serials','boolean', '0',  '0');

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — SERIAL IMPORT BATCHES (AI doc processing + manual batches)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE serial_import_batches (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id                 INTEGER NOT NULL REFERENCES purchase_orders(id),
    po_line_id            INTEGER NOT NULL REFERENCES purchase_order_lines(id),
    shipment_reference    TEXT NOT NULL,
    source_type           TEXT NOT NULL CHECK(source_type IN ('manual','ai_document','excel')),
    document_file_path    TEXT,            -- path to uploaded source document
    status                TEXT NOT NULL DEFAULT 'Pending'
                          CHECK(status IN ('Pending','Confirmed','Rejected')),
    confirmed_at          TIMESTAMP,
    imported_by_user_id   INTEGER REFERENCES users(id),
    imported_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — REPAIR DOCUMENTS (uploaded against RR orders — storage only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE repair_documents (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    rr_order_id           INTEGER NOT NULL REFERENCES repair_rework_orders(id),
    file_name             TEXT NOT NULL,
    file_path             TEXT NOT NULL,
    file_size_bytes       INTEGER,
    uploaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by_user_id   INTEGER REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TABLES — AI ASSISTANT CONVERSATIONS & MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    session_id  TEXT NOT NULL UNIQUE,
    page_context TEXT,              -- page/module open when conversation started
    started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at    TIMESTAMP
);

CREATE TABLE ai_messages (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id   INTEGER NOT NULL REFERENCES ai_conversations(id),
    role              TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content           TEXT NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 ALTERATIONS TO EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- locations: add region and country references
ALTER TABLE locations ADD COLUMN region_id   INTEGER REFERENCES regions(id);
ALTER TABLE locations ADD COLUMN country_id  INTEGER REFERENCES countries(id);

-- users: add demand_planner_region for legacy support
ALTER TABLE users ADD COLUMN demand_planner_region TEXT;

-- customers: add segment and country references
ALTER TABLE customers ADD COLUMN segment_id  INTEGER REFERENCES customer_segments(id);
ALTER TABLE customers ADD COLUMN country_id  INTEGER REFERENCES countries(id);

-- products: add firmware reference
ALTER TABLE products ADD COLUMN latest_firmware_id  INTEGER REFERENCES firmware(id);

-- product_bom_components: add assembly leadtime (quantity already present)
ALTER TABLE product_bom_components ADD COLUMN assembly_leadtime_value  INTEGER;
ALTER TABLE product_bom_components ADD COLUMN assembly_leadtime_unit   TEXT CHECK(assembly_leadtime_unit IN ('Hours','Days'));

-- purchase_order_lines: add price per product (R3 Quality Hold requirement)
ALTER TABLE purchase_order_lines ADD COLUMN price_per_product  REAL;
ALTER TABLE purchase_order_lines ADD COLUMN price_currency     TEXT;

-- outbound_order_lines: add ATP fulfilment fields
ALTER TABLE outbound_order_lines ADD COLUMN fulfilling_location_id   INTEGER REFERENCES locations(id);
ALTER TABLE outbound_order_lines ADD COLUMN edd                      DATE;       -- estimated delivery date
ALTER TABLE outbound_order_lines ADD COLUMN atp_status               TEXT CHECK(atp_status IN ('ATP_OK','ATP_PARTIAL','ATP_NONE'));
ALTER TABLE outbound_order_lines ADD COLUMN bom_assembly_status      TEXT CHECK(bom_assembly_status IN ('COMPLETE','PARTIAL','PENDING'));

-- outbound_orders: add allocation donor reference
ALTER TABLE outbound_orders ADD COLUMN allocation_source_order_id  INTEGER REFERENCES outbound_orders(id);

-- serial_numbers: add firmware, pegging, and import batch references
ALTER TABLE serial_numbers ADD COLUMN firmware_id          INTEGER REFERENCES firmware(id);
ALTER TABLE serial_numbers ADD COLUMN firmware_applied_at  TIMESTAMP;
ALTER TABLE serial_numbers ADD COLUMN pegged_to_order_id   INTEGER REFERENCES outbound_orders(id);
ALTER TABLE serial_numbers ADD COLUMN import_batch_id      INTEGER REFERENCES serial_import_batches(id);

-- return_orders: add RMA reference
ALTER TABLE return_orders ADD COLUMN rma_reference  TEXT;   -- format: RMAxxxxxx

-- repair_rework_orders: add RMA reference
ALTER TABLE repair_rework_orders ADD COLUMN rma_reference  TEXT;   -- matched to return_orders.rma_reference

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 NEW TERMINAL STATE & ORDER NUMBERING
-- ─────────────────────────────────────────────────────────────────────────────

-- New terminal state: QUALITY_HOLD (R3 Phase 3D)
INSERT INTO terminal_states (code, display_name, warehouse_type, sequence_number,
    expected_duration_value, expected_duration_unit) VALUES
    ('QUALITY_HOLD', 'Quality Hold', 'Pre-Warehouse', 2, NULL, NULL);

-- New order numbering: RMA (R3 Phase 3E)
INSERT INTO order_numbering (order_type, prefix, padding_length) VALUES
    ('RMAOrder', 'RMA', 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- R3 INDEXES (supporting new tables and R3 features)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_sn_firmware      ON serial_numbers(firmware_id);
CREATE INDEX idx_sn_pegged        ON serial_numbers(pegged_to_order_id);
CREATE INDEX idx_sn_batch         ON serial_numbers(import_batch_id);
CREATE INDEX idx_supply_flows_ver ON supply_flows(network_version_id);
CREATE INDEX idx_flow_from        ON supply_flows(from_location_id);
CREATE INDEX idx_flow_to          ON supply_flows(to_location_id);
CREATE INDEX idx_atp_rules_region ON atp_rules(region_id);
CREATE INDEX idx_rr_docs          ON repair_documents(rr_order_id);
CREATE INDEX idx_ai_conv_user     ON ai_conversations(user_id);
CREATE INDEX idx_ai_msg_conv      ON ai_messages(conversation_id);
CREATE INDEX idx_batches_po       ON serial_import_batches(po_id);
CREATE INDEX idx_return_rma       ON return_orders(rma_reference);
CREATE INDEX idx_rr_rma           ON repair_rework_orders(rma_reference);
