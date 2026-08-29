-- ============================================================================
-- Auto-generated SQLite schema — reflected from local dev terminal_tracking.db
-- Regenerate with: backend/tools/generate_pg_schema.py
-- Used to bootstrap a fresh clone's local SQLite DB. Do not hand-edit; fix the
-- source SQLite DB / ORM models and regenerate instead.
-- ============================================================================

CREATE TABLE IF NOT EXISTS accessories_inventory (
	id INTEGER, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	state TEXT DEFAULT 'Available' NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	UNIQUE (product_id, location_id, state)
);
CREATE TABLE IF NOT EXISTS locations (
	id INTEGER, 
	code TEXT NOT NULL, 
	name TEXT NOT NULL, 
	location_type_id INTEGER NOT NULL, 
	country TEXT NOT NULL, 
	city TEXT, 
	reporting_currency TEXT DEFAULT 'EUR' NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	region_id INTEGER, 
	country_id INTEGER, 
	country_code TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES countries (id), 
	FOREIGN KEY(region_id) REFERENCES regions (id), 
	FOREIGN KEY(location_type_id) REFERENCES location_types (id), 
	UNIQUE (code)
);
CREATE TABLE IF NOT EXISTS countries (
	id INTEGER, 
	country_code TEXT NOT NULL, 
	country_name TEXT NOT NULL, 
	region_id INTEGER NOT NULL, 
	serviced INTEGER DEFAULT 0 NOT NULL, 
	activated_at TIMESTAMP, 
	currency TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(region_id) REFERENCES regions (id), 
	UNIQUE (country_code)
);
CREATE TABLE IF NOT EXISTS regions (
	id INTEGER, 
	region_code TEXT NOT NULL, 
	region_name TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (region_code)
);
CREATE TABLE IF NOT EXISTS location_types (
	id INTEGER, 
	name TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	gr_applicable INTEGER DEFAULT 1 NOT NULL, 
	accruals_applicable TEXT DEFAULT 'NA' NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS products (
	id INTEGER, 
	code TEXT NOT NULL, 
	name TEXT NOT NULL, 
	description TEXT, 
	product_type TEXT NOT NULL, 
	product_category TEXT NOT NULL, 
	serialised INTEGER DEFAULT 0 NOT NULL, 
	is_bom INTEGER DEFAULT 0 NOT NULL, 
	unit_value REAL, 
	unit_currency TEXT DEFAULT 'EUR', 
	refurb_unit_value REAL, 
	refurb_unit_currency TEXT, 
	hs_code TEXT, 
	active INTEGER DEFAULT 1 NOT NULL, 
	vendor_keyloaded INTEGER DEFAULT 0 NOT NULL, 
	unit_value_symbol TEXT, 
	unit_value_decimals INTEGER DEFAULT 2, 
	unit_value_display TEXT, 
	updated_at TIMESTAMP, 
	battery_life_days INTEGER, 
	warranty_days INTEGER, 
	repair_max_days INTEGER, 
	image_data BLOB, 
	image_content_type TEXT, 
	latest_firmware_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(latest_firmware_id) REFERENCES firmware (id), 
	UNIQUE (code), 
	CHECK (product_type IN ('Payment Terminal','Accessory','Battery')), 
	CHECK (product_category IN ('PaymentDevice','SerializedAccessory','Accessory'))
);
CREATE TABLE IF NOT EXISTS firmware (
	id INTEGER, 
	firmware_name TEXT NOT NULL, 
	version TEXT NOT NULL, 
	release_number TEXT, 
	release_date DATE, 
	release_hour TEXT, 
	key_used TEXT, 
	file_path TEXT, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	product_id INTEGER, 
	active INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	UNIQUE (firmware_name, version, release_number)
);
CREATE TABLE IF NOT EXISTS activity_cost_master (
	id INTEGER NOT NULL, 
	location_code TEXT NOT NULL, 
	state_code TEXT NOT NULL, 
	product_code TEXT, 
	amount FLOAT NOT NULL, 
	currency TEXT NOT NULL, 
	active INTEGER NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS activity_costs (
	id INTEGER, 
	location_id INTEGER NOT NULL, 
	state_id INTEGER NOT NULL, 
	product_id INTEGER, 
	amount REAL NOT NULL, 
	currency TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(state_id) REFERENCES terminal_states (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id)
);
CREATE TABLE IF NOT EXISTS terminal_states (
	id INTEGER, 
	code TEXT NOT NULL, 
	display_name TEXT NOT NULL, 
	warehouse_type TEXT, 
	description TEXT, 
	active INTEGER DEFAULT 1 NOT NULL, 
	sequence_number INTEGER, 
	expected_duration_value REAL, 
	expected_duration_unit TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (code)
);
CREATE TABLE IF NOT EXISTS agent_allocation_intents (
	id INTEGER NOT NULL, 
	run_id TEXT NOT NULL, 
	agent_name TEXT NOT NULL, 
	product_id INTEGER, 
	from_location_id INTEGER, 
	to_location_id INTEGER, 
	reserved_qty INTEGER NOT NULL, 
	remaining_qty INTEGER NOT NULL, 
	reasoning TEXT, 
	status TEXT NOT NULL, 
	horizon_days INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	executed_at TIMESTAMP, 
	cancelled_at TIMESTAMP, 
	cancelled_by_user_id INTEGER, 
	execution_do_refs TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(from_location_id) REFERENCES locations (id), 
	FOREIGN KEY(to_location_id) REFERENCES locations (id), 
	FOREIGN KEY(cancelled_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS users (
	id INTEGER, 
	username TEXT NOT NULL, 
	email TEXT, 
	password_hash TEXT NOT NULL, 
	role TEXT NOT NULL, 
	default_location_id INTEGER, 
	active INTEGER DEFAULT 1 NOT NULL, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	supplier_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(default_location_id) REFERENCES locations (id), 
	UNIQUE (username), 
	UNIQUE (email), 
	CHECK (role IN (
                                    'admin','supply_planner','warehouse_user',
                                    'repair_centre','supplier','demand_planner'
                                ))
);
CREATE TABLE IF NOT EXISTS suppliers (
	id INTEGER, 
	code TEXT NOT NULL, 
	name TEXT NOT NULL, 
	country TEXT NOT NULL, 
	city TEXT, 
	contact_email TEXT, 
	contact_phone TEXT, 
	active INTEGER DEFAULT 1 NOT NULL, 
	country_code TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (code)
);
CREATE TABLE IF NOT EXISTS agent_logs (
	id INTEGER, 
	run_id TEXT NOT NULL, 
	agent_name TEXT NOT NULL, 
	step_type TEXT NOT NULL, 
	message TEXT, 
	order_ref TEXT, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS agent_recommendations (
	id INTEGER, 
	run_id TEXT NOT NULL, 
	agent_name TEXT NOT NULL, 
	rec_type TEXT NOT NULL, 
	product_id INTEGER, 
	from_location_id INTEGER, 
	to_location_id INTEGER, 
	qty INTEGER, 
	shortage_qty INTEGER, 
	estimated_value REAL, 
	status TEXT DEFAULT 'Pending' NOT NULL, 
	order_ref TEXT, 
	notes TEXT, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	actioned_at TIMESTAMP, 
	actioned_by_user_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(actioned_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(to_location_id) REFERENCES locations (id), 
	FOREIGN KEY(from_location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE TABLE IF NOT EXISTS agent_runs (
	id INTEGER NOT NULL, 
	run_id TEXT NOT NULL, 
	agent_name TEXT NOT NULL, 
	triggered_by TEXT, 
	status TEXT NOT NULL, 
	shortages_found INTEGER, 
	actions_taken INTEGER, 
	hitl_items INTEGER, 
	intents_recorded INTEGER, 
	intents_executed INTEGER, 
	summary_text TEXT, 
	started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	completed_at TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (run_id)
);
CREATE TABLE IF NOT EXISTS ai_conversations (
	id INTEGER, 
	user_id INTEGER NOT NULL, 
	session_id TEXT NOT NULL, 
	page_context TEXT, 
	started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	ended_at TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (session_id)
);
CREATE TABLE IF NOT EXISTS ai_messages (
	id INTEGER, 
	conversation_id INTEGER NOT NULL, 
	role TEXT NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(conversation_id) REFERENCES ai_conversations (id), 
	CHECK (role IN ('user','assistant'))
);
CREATE TABLE IF NOT EXISTS alert_rules (
	id INTEGER NOT NULL, 
	rule_code TEXT NOT NULL, 
	name TEXT NOT NULL, 
	description TEXT, 
	enabled INTEGER NOT NULL, 
	threshold_urgent_days INTEGER, 
	threshold_critical_days INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (rule_code)
);
CREATE TABLE IF NOT EXISTS alerts (
	id INTEGER NOT NULL, 
	rule_id INTEGER NOT NULL, 
	severity TEXT NOT NULL, 
	status TEXT NOT NULL, 
	serial_id INTEGER, 
	product_id INTEGER, 
	location_id INTEGER, 
	reference_id INTEGER, 
	reference_type TEXT, 
	message TEXT NOT NULL, 
	days_overdue INTEGER, 
	acknowledged_by_user_id INTEGER, 
	acknowledged_at TIMESTAMP, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(rule_id) REFERENCES alert_rules (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(acknowledged_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS serial_numbers (
	id INTEGER, 
	serial_number TEXT NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	current_state_id INTEGER, 
	current_location_id INTEGER, 
	stock_type TEXT DEFAULT 'Live' NOT NULL, 
	security_seal INTEGER DEFAULT 0, 
	key_loaded INTEGER DEFAULT 0, 
	po_id INTEGER, 
	po_line_id INTEGER, 
	active INTEGER DEFAULT 1 NOT NULL, 
	accumulated_cost REAL DEFAULT 0, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	lot_number TEXT, 
	terminal_type TEXT, 
	wifi_mac TEXT, 
	bluetooth_mac TEXT, 
	ethernet_mac TEXT, 
	imei1 TEXT, 
	imei2 TEXT, 
	iccid TEXT, 
	eid TEXT, 
	key_id TEXT, 
	firmware_id INTEGER, 
	firmware_applied_at TIMESTAMP, 
	pegged_to_order_id INTEGER, 
	import_batch_id INTEGER, 
	shipment_reference TEXT, 
	carrier TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(import_batch_id) REFERENCES serial_import_batches (id), 
	FOREIGN KEY(pegged_to_order_id) REFERENCES outbound_orders (id), 
	FOREIGN KEY(firmware_id) REFERENCES firmware (id), 
	FOREIGN KEY(po_line_id) REFERENCES purchase_order_lines (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id), 
	FOREIGN KEY(current_location_id) REFERENCES locations (id), 
	FOREIGN KEY(current_state_id) REFERENCES terminal_states (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	UNIQUE (serial_number, supplier_id), 
	CHECK (stock_type IN ('Live','Refurbished','Returned','Test'))
);
CREATE TABLE IF NOT EXISTS serial_import_batches (
	id INTEGER, 
	po_id INTEGER NOT NULL, 
	po_line_id INTEGER NOT NULL, 
	shipment_reference TEXT NOT NULL, 
	source_type TEXT NOT NULL, 
	document_file_path TEXT, 
	status TEXT DEFAULT 'Pending' NOT NULL, 
	confirmed_at TIMESTAMP, 
	imported_by_user_id INTEGER, 
	imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(imported_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(po_line_id) REFERENCES purchase_order_lines (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id), 
	CHECK (source_type IN ('manual','ai_document','excel')), 
	CHECK (status IN ('Pending','Confirmed','Rejected'))
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
	id INTEGER, 
	po_id INTEGER NOT NULL, 
	line_number INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	qty_ordered INTEGER NOT NULL, 
	qty_expected INTEGER DEFAULT 0 NOT NULL, 
	qty_received INTEGER DEFAULT 0 NOT NULL, 
	received_date TEXT, 
	price_per_product REAL, 
	price_currency TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id), 
	UNIQUE (po_id, line_number)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
	id INTEGER, 
	po_number TEXT NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	destination_location_id INTEGER NOT NULL, 
	order_date DATE NOT NULL, 
	expected_arrival_date DATE, 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	received_date TEXT, 
	external_reference TEXT, 
	partial_order TEXT, 
	environment TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(destination_location_id) REFERENCES locations (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	UNIQUE (po_number), 
	CHECK (status IN ('Draft','Issued','Expected','Partially Received','Fully Received','Closed','Cancelled'))
);
CREATE TABLE IF NOT EXISTS outbound_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	order_type TEXT NOT NULL, 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	customer_id INTEGER, 
	destination_location_id INTEGER, 
	atp_ship_date DATE, 
	atp_delivery_date DATE, 
	atp_feasible INTEGER DEFAULT 1, 
	fulfilling_location_id INTEGER, 
	carrier TEXT, 
	tracking_number TEXT, 
	shipped_date DATE, 
	estimated_arrival_date DATE, 
	shipping_cost REAL, 
	shipping_cost_currency TEXT, 
	rental_period_months INTEGER, 
	rental_fee REAL, 
	rental_fee_currency TEXT, 
	rental_expected_return_date DATE, 
	linked_return_order_id INTEGER, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	order_state TEXT, 
	merchant_reference TEXT, 
	stock TEXT, 
	location_code TEXT, 
	company_account TEXT, 
	environment TEXT, 
	inv_from_company TEXT, 
	inv_from_vat_number TEXT, 
	inv_from_reg_number TEXT, 
	inv_from_phone TEXT, 
	inv_from_addr_line1 TEXT, 
	inv_from_addr_line2 TEXT, 
	inv_from_addr_city TEXT, 
	inv_from_addr_postal TEXT, 
	inv_from_addr_state TEXT, 
	inv_from_addr_country TEXT, 
	inv_to_company TEXT, 
	inv_to_attention TEXT, 
	inv_to_vat_number TEXT, 
	inv_to_phone TEXT, 
	inv_to_addr_line1 TEXT, 
	inv_to_addr_line2 TEXT, 
	inv_to_addr_city TEXT, 
	inv_to_addr_postal TEXT, 
	inv_to_addr_state TEXT, 
	inv_to_addr_country TEXT, 
	tracking_type TEXT, 
	shipment_vat_number TEXT, 
	allocation_source_order_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(allocation_source_order_id) REFERENCES outbound_orders (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(linked_return_order_id) REFERENCES return_orders (id), 
	FOREIGN KEY(fulfilling_location_id) REFERENCES locations (id), 
	FOREIGN KEY(destination_location_id) REFERENCES locations (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	UNIQUE (order_number), 
	CHECK (order_type IN ('Sales','Rental','Replacement','Distribution')), 
	CHECK (status IN ('Draft','Issued','Allocated','In Picking','Shipped','Delivered','Closed','Delivery Failed','Cancelled'))
);
CREATE TABLE IF NOT EXISTS return_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	original_order_id INTEGER, 
	customer_id INTEGER, 
	reason TEXT NOT NULL, 
	status TEXT DEFAULT 'Initiated' NOT NULL, 
	inspection_outcome TEXT, 
	linked_replacement_order_id INTEGER, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	linked_rr_order_id INTEGER, 
	rma_reference TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(linked_rr_order_id) REFERENCES repair_rework_orders (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(linked_replacement_order_id) REFERENCES outbound_orders (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	FOREIGN KEY(original_order_id) REFERENCES outbound_orders (id), 
	UNIQUE (order_number), 
	CHECK (reason IN ('Defective','End of Rental','End of Lifecycle','Wrong Item','Other')), 
	CHECK (status IN ('Initiated','In Transit','Received','Inspected','Closed')), 
	CHECK (inspection_outcome IN ('Defective','Scrap'))
);
CREATE TABLE IF NOT EXISTS repair_rework_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	location_id INTEGER, 
	external_reference TEXT, 
	dispatch_type TEXT DEFAULT 'Repair' NOT NULL, 
	reason TEXT, 
	environment TEXT DEFAULT 'Live', 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	outbound_shipped_at TIMESTAMP, 
	ship_to_first_name TEXT, 
	ship_to_last_name TEXT, 
	ship_to_company TEXT, 
	ship_to_phone TEXT, 
	ship_to_email TEXT, 
	ship_to_addr_line1 TEXT, 
	ship_to_addr_city TEXT, 
	ship_to_addr_postal TEXT, 
	ship_to_addr_state TEXT, 
	ship_to_addr_country TEXT, 
	tracking_type TEXT, 
	tracking_carrier TEXT, 
	tracking_number TEXT, 
	inbound_shipped_at TIMESTAMP, 
	inbound_key TEXT, 
	inbounded_at TIMESTAMP, 
	estimated_return_date TEXT, 
	actual_return_date TEXT, 
	return_location_id INTEGER, 
	outcome TEXT, 
	actual_cost REAL, 
	actual_cost_currency TEXT, 
	repair_notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	rma_reference TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(return_location_id) REFERENCES locations (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	UNIQUE (order_number)
);
CREATE TABLE IF NOT EXISTS customers (
	id INTEGER, 
	customer_ref TEXT NOT NULL, 
	duns_number TEXT, 
	name TEXT NOT NULL, 
	customer_type TEXT NOT NULL, 
	country TEXT NOT NULL, 
	state_region TEXT, 
	credit_rating TEXT, 
	delivery_address TEXT, 
	contact_email TEXT, 
	contact_phone TEXT, 
	active INTEGER DEFAULT 1 NOT NULL, 
	segment_id INTEGER, 
	country_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES countries (id), 
	FOREIGN KEY(segment_id) REFERENCES customer_segments (id), 
	UNIQUE (customer_ref), 
	CHECK (customer_type IN ('Shop','Merchant','Distributor','Partner'))
);
CREATE TABLE IF NOT EXISTS customer_segments (
	id INTEGER, 
	segment_code TEXT NOT NULL, 
	segment_name TEXT NOT NULL, 
	priority INTEGER DEFAULT 99 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (segment_code)
);
CREATE TABLE IF NOT EXISTS assembly_times (
	id INTEGER, 
	location_id INTEGER NOT NULL, 
	duration_days INTEGER DEFAULT 2 NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id)
);
CREATE TABLE IF NOT EXISTS atp_rules (
	id INTEGER, 
	region_id INTEGER, 
	segment_id INTEGER, 
	rule_key TEXT NOT NULL, 
	rule_value TEXT NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(segment_id) REFERENCES customer_segments (id), 
	FOREIGN KEY(region_id) REFERENCES regions (id)
);
CREATE TABLE IF NOT EXISTS business_calendar_holidays (
	id INTEGER, 
	calendar_id INTEGER NOT NULL, 
	holiday_date TEXT NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(calendar_id) REFERENCES business_calendars (id), 
	UNIQUE (calendar_id, holiday_date)
);
CREATE TABLE IF NOT EXISTS business_calendars (
	id INTEGER, 
	entity_type TEXT NOT NULL, 
	location_id INTEGER, 
	supplier_id INTEGER, 
	timezone TEXT DEFAULT 'UTC' NOT NULL, 
	working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri' NOT NULL, 
	work_hours_start TEXT DEFAULT '08:00' NOT NULL, 
	work_hours_end TEXT DEFAULT '17:00' NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id)
);
CREATE TABLE IF NOT EXISTS claim_attachments (
	id INTEGER NOT NULL, 
	claim_id INTEGER NOT NULL, 
	filename TEXT NOT NULL, 
	content_type TEXT, 
	data BLOB NOT NULL, 
	uploaded_by_user_id INTEGER, 
	uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(claim_id) REFERENCES claims (id), 
	FOREIGN KEY(uploaded_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS claims (
	id INTEGER NOT NULL, 
	claim_number TEXT NOT NULL, 
	po_id INTEGER, 
	serial_id INTEGER, 
	claim_type_id INTEGER NOT NULL, 
	raised_against TEXT NOT NULL, 
	status TEXT NOT NULL, 
	description TEXT, 
	resolution_notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	urgency TEXT DEFAULT 'Normal' NOT NULL, 
	outbound_order_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(claim_type_id) REFERENCES claim_types (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(outbound_order_id) REFERENCES outbound_orders (id), 
	UNIQUE (claim_number)
);
CREATE TABLE IF NOT EXISTS claim_types (
	id INTEGER NOT NULL, 
	name TEXT NOT NULL, 
	description TEXT, 
	raised_against TEXT NOT NULL, 
	active INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS demand_signals (
	id INTEGER, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER, 
	period_date TEXT NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE TABLE IF NOT EXISTS distribution_order_lines (
	id INTEGER, 
	dist_order_id INTEGER NOT NULL, 
	line_id TEXT, 
	product_id INTEGER, 
	quantity INTEGER NOT NULL, 
	stock TEXT, 
	product_state TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(dist_order_id) REFERENCES distribution_orders (id), 
	UNIQUE (dist_order_id, line_id)
);
CREATE TABLE IF NOT EXISTS distribution_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	distribution_reference TEXT, 
	environment TEXT DEFAULT 'Live', 
	inbound_state TEXT, 
	origin_location_id INTEGER, 
	destination_location_id INTEGER, 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	shipped_at TIMESTAMP, 
	delivered_at TIMESTAMP, 
	ship_from_company TEXT, 
	ship_from_first_name TEXT, 
	ship_from_last_name TEXT, 
	ship_from_phone TEXT, 
	ship_from_email TEXT, 
	ship_from_addr_line1 TEXT, 
	ship_from_addr_line2 TEXT, 
	ship_from_addr_city TEXT, 
	ship_from_addr_postal TEXT, 
	ship_from_addr_state TEXT, 
	ship_from_addr_country TEXT, 
	ship_to_company TEXT, 
	ship_to_first_name TEXT, 
	ship_to_last_name TEXT, 
	ship_to_phone TEXT, 
	ship_to_email TEXT, 
	ship_to_addr_line1 TEXT, 
	ship_to_addr_line2 TEXT, 
	ship_to_addr_city TEXT, 
	ship_to_addr_postal TEXT, 
	ship_to_addr_state TEXT, 
	ship_to_addr_country TEXT, 
	tracking_type TEXT, 
	tracking_carrier TEXT, 
	tracking_number TEXT, 
	inbound_key TEXT, 
	inbounded_at TIMESTAMP, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(destination_location_id) REFERENCES locations (id), 
	FOREIGN KEY(origin_location_id) REFERENCES locations (id), 
	UNIQUE (order_number)
);
CREATE TABLE IF NOT EXISTS distribution_order_nonserial (
	id INTEGER, 
	dist_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(dist_order_id) REFERENCES distribution_orders (id)
);
CREATE TABLE IF NOT EXISTS distribution_order_serials (
	id INTEGER, 
	dist_order_id INTEGER NOT NULL, 
	shipped_line_id TEXT, 
	serial_id INTEGER, 
	security_seal TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(dist_order_id) REFERENCES distribution_orders (id), 
	UNIQUE (dist_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS distribution_received (
	id INTEGER, 
	dist_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	product_state TEXT, 
	serials TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(dist_order_id) REFERENCES distribution_orders (id)
);
CREATE TABLE IF NOT EXISTS exchange_rate_master (
	id INTEGER NOT NULL, 
	from_currency TEXT NOT NULL, 
	to_currency TEXT NOT NULL, 
	rate FLOAT NOT NULL, 
	effective_date TEXT NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS exchange_rates (
	id INTEGER, 
	from_currency TEXT NOT NULL, 
	to_currency TEXT NOT NULL, 
	rate REAL NOT NULL, 
	effective_date DATE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (from_currency, to_currency, effective_date)
);
CREATE TABLE IF NOT EXISTS flow_constraints (
	id INTEGER, 
	flow_id INTEGER NOT NULL, 
	product_id INTEGER, 
	replenishment_type TEXT, 
	valid_from DATE, 
	valid_to DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(flow_id) REFERENCES supply_flows (id)
);
CREATE TABLE IF NOT EXISTS supply_flows (
	id INTEGER, 
	network_version_id INTEGER NOT NULL, 
	from_location_id INTEGER, 
	from_supplier_id INTEGER, 
	to_location_id INTEGER, 
	to_supplier_id INTEGER, 
	flow_type TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	lead_time REAL, 
	lead_time_unit TEXT DEFAULT "days" NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(to_supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(to_location_id) REFERENCES locations (id), 
	FOREIGN KEY(from_supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(from_location_id) REFERENCES locations (id), 
	FOREIGN KEY(network_version_id) REFERENCES network_versions (id)
);
CREATE TABLE IF NOT EXISTS network_versions (
	id INTEGER, 
	version_name TEXT NOT NULL, 
	version_type TEXT NOT NULL, 
	reference_number TEXT, 
	effective_date DATE, 
	committed_at TIMESTAMP, 
	committed_by_user_id INTEGER, 
	notes TEXT, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	is_current INTEGER DEFAULT 0 NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(committed_by_user_id) REFERENCES users (id), 
	CHECK (version_type IN ('baseline','simulation'))
);
CREATE TABLE IF NOT EXISTS goods_receipt_messages (
	id INTEGER NOT NULL, 
	po_id INTEGER, 
	location_id INTEGER NOT NULL, 
	message_type TEXT NOT NULL, 
	serial_count INTEGER NOT NULL, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	created_by_user_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS inbound_shipments (
	id INTEGER, 
	po_id INTEGER NOT NULL, 
	shipment_reference TEXT, 
	carrier TEXT, 
	carrier_tracking_ref TEXT, 
	estimated_arrival_date DATE, 
	uploaded_by_user_id INTEGER, 
	uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploaded_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(po_id) REFERENCES purchase_orders (id)
);
CREATE TABLE IF NOT EXISTS mass_upload_log (
	id INTEGER, 
	upload_type TEXT NOT NULL, 
	uploaded_by_user_id INTEGER, 
	filename TEXT, 
	total_records INTEGER DEFAULT 0 NOT NULL, 
	successful_records INTEGER DEFAULT 0 NOT NULL, 
	failed_records INTEGER DEFAULT 0 NOT NULL, 
	error_report TEXT, 
	uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploaded_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS non_serialised_inventory (
	id INTEGER, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	state TEXT DEFAULT 'Available' NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	UNIQUE (product_id, location_id, state), 
	CHECK (state IN ('Received','Available'))
);
CREATE TABLE IF NOT EXISTS order_numbering (
	id INTEGER, 
	order_type TEXT NOT NULL, 
	prefix TEXT NOT NULL, 
	padding_length INTEGER DEFAULT 6 NOT NULL, 
	current_sequence INTEGER DEFAULT 0 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (order_type)
);
CREATE TABLE IF NOT EXISTS outbound_order_lines (
	id INTEGER, 
	order_id INTEGER NOT NULL, 
	line_number INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	line_id TEXT, 
	group_id TEXT, 
	fulfilling_location_id INTEGER, 
	edd DATE, 
	atp_status TEXT, 
	bom_assembly_status TEXT, 
	component_transfer_orders TEXT, 
	atp_reasoning TEXT, 
	atp_split_details TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(fulfilling_location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(order_id) REFERENCES outbound_orders (id), 
	UNIQUE (order_id, line_number)
);
CREATE TABLE IF NOT EXISTS outbound_order_nonserial (
	id INTEGER, 
	order_id INTEGER NOT NULL, 
	order_line_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(order_line_id) REFERENCES outbound_order_lines (id), 
	FOREIGN KEY(order_id) REFERENCES outbound_orders (id), 
	UNIQUE (order_id, order_line_id, product_id)
);
CREATE TABLE IF NOT EXISTS outbound_order_serials (
	id INTEGER, 
	order_id INTEGER NOT NULL, 
	order_line_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	shipped_line_id TEXT, 
	security_seal TEXT, 
	iccid TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(order_line_id) REFERENCES outbound_order_lines (id), 
	FOREIGN KEY(order_id) REFERENCES outbound_orders (id), 
	UNIQUE (order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS product_alternatives (
	id INTEGER, 
	product_id INTEGER NOT NULL, 
	alternative_product_id INTEGER NOT NULL, 
	sequence INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(alternative_product_id) REFERENCES products (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	UNIQUE (product_id, alternative_product_id), 
	CHECK (product_id != alternative_product_id)
);
CREATE TABLE IF NOT EXISTS product_bom_components (
	id INTEGER, 
	parent_product_id INTEGER NOT NULL, 
	component_product_id INTEGER NOT NULL, 
	quantity INTEGER DEFAULT 1 NOT NULL, 
	assembly_leadtime_value INTEGER, 
	assembly_leadtime_unit TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(component_product_id) REFERENCES products (id), 
	FOREIGN KEY(parent_product_id) REFERENCES products (id), 
	UNIQUE (parent_product_id, component_product_id), 
	CHECK (parent_product_id != component_product_id)
);
CREATE TABLE IF NOT EXISTS product_countries (
	product_id INTEGER NOT NULL, 
	country_code TEXT NOT NULL, 
	PRIMARY KEY (product_id, country_code), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE TABLE IF NOT EXISTS product_interchangeable (
	product_id INTEGER NOT NULL, 
	interchangeable_product_id INTEGER NOT NULL, 
	PRIMARY KEY (product_id, interchangeable_product_id), 
	FOREIGN KEY(interchangeable_product_id) REFERENCES products (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	CHECK (product_id != interchangeable_product_id)
);
CREATE TABLE IF NOT EXISTS product_pricing (
	id INTEGER, 
	product_id INTEGER NOT NULL, 
	region_id INTEGER, 
	country_id INTEGER, 
	sell_price REAL, 
	rental_price_month REAL, 
	currency TEXT NOT NULL, 
	effective_date DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES countries (id), 
	FOREIGN KEY(region_id) REFERENCES regions (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	UNIQUE (product_id, region_id, country_id)
);
CREATE TABLE IF NOT EXISTS product_repair_centres (
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	PRIMARY KEY (product_id, location_id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE TABLE IF NOT EXISTS product_suppliers (
	product_id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	lead_time_days INTEGER, 
	PRIMARY KEY (product_id, supplier_id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE TABLE IF NOT EXISTS repair_documents (
	id INTEGER, 
	rr_order_id INTEGER NOT NULL, 
	file_name TEXT NOT NULL, 
	file_path TEXT NOT NULL, 
	file_size_bytes INTEGER, 
	uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	uploaded_by_user_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploaded_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(rr_order_id) REFERENCES repair_rework_orders (id)
);
CREATE TABLE IF NOT EXISTS repair_order_serials (
	id INTEGER, 
	repair_order_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(repair_order_id) REFERENCES repair_orders (id), 
	UNIQUE (repair_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS repair_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	return_order_id INTEGER, 
	repair_centre_location_id INTEGER NOT NULL, 
	dispatch_date DATE, 
	estimated_return_date DATE, 
	actual_return_date DATE, 
	return_location_id INTEGER, 
	status TEXT DEFAULT 'Dispatched' NOT NULL, 
	outcome TEXT, 
	actual_cost REAL, 
	actual_cost_currency TEXT, 
	repair_notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(return_location_id) REFERENCES locations (id), 
	FOREIGN KEY(repair_centre_location_id) REFERENCES locations (id), 
	FOREIGN KEY(return_order_id) REFERENCES return_orders (id), 
	UNIQUE (order_number), 
	CHECK (status IN ('Dispatched','Received at Repair Centre','In Repair','Completed','Returned')), 
	CHECK (outcome IN ('Repaired','Beyond Repair'))
);
CREATE TABLE IF NOT EXISTS repair_rework_received (
	id INTEGER, 
	rr_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	product_state TEXT, 
	serials TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(rr_order_id) REFERENCES repair_rework_orders (id)
);
CREATE TABLE IF NOT EXISTS repair_rework_serials (
	id INTEGER, 
	rr_order_id INTEGER NOT NULL, 
	serial_id INTEGER, 
	product_code TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(rr_order_id) REFERENCES repair_rework_orders (id), 
	UNIQUE (rr_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS return_order_serials (
	id INTEGER, 
	return_order_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(return_order_id) REFERENCES return_orders (id), 
	UNIQUE (return_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS safety_stock_targets (
	id INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	min_qty INTEGER NOT NULL, 
	reorder_point INTEGER NOT NULL, 
	reorder_qty INTEGER NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS state_history (
	id INTEGER, 
	serial_number_id INTEGER NOT NULL, 
	state_id INTEGER NOT NULL, 
	location_id INTEGER, 
	datetime_utc TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	timezone TEXT DEFAULT 'UTC' NOT NULL, 
	actor_type TEXT NOT NULL, 
	actor_user_id INTEGER, 
	notes TEXT, 
	activity_description TEXT, 
	order_reference TEXT, 
	activity_cost REAL, 
	activity_cost_currency TEXT, 
	reporting_currency_equiv REAL, 
	exchange_rate_applied REAL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(state_id) REFERENCES terminal_states (id), 
	FOREIGN KEY(serial_number_id) REFERENCES serial_numbers (id), 
	CHECK (actor_type IN ('user','api','system'))
);
CREATE TABLE IF NOT EXISTS state_transitions (
	id INTEGER, 
	from_state_id INTEGER, 
	to_state_id INTEGER NOT NULL, 
	acting_role TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(to_state_id) REFERENCES terminal_states (id), 
	FOREIGN KEY(from_state_id) REFERENCES terminal_states (id), 
	UNIQUE (from_state_id, to_state_id, acting_role)
);
CREATE TABLE IF NOT EXISTS state_valid_location_types (
	state_id INTEGER NOT NULL, 
	location_type_id INTEGER NOT NULL, 
	PRIMARY KEY (state_id, location_type_id), 
	FOREIGN KEY(location_type_id) REFERENCES location_types (id), 
	FOREIGN KEY(state_id) REFERENCES terminal_states (id)
);
CREATE TABLE IF NOT EXISTS supplier_users (
	user_id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, supplier_id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS system_config (
	id INTEGER, 
	config_key TEXT NOT NULL, 
	label TEXT NOT NULL, 
	description TEXT, 
	data_type TEXT NOT NULL, 
	current_value TEXT, 
	default_value TEXT, 
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	updated_by_user_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(updated_by_user_id) REFERENCES users (id), 
	UNIQUE (config_key), 
	CHECK (data_type IN ('string','integer','boolean','decimal'))
);
CREATE TABLE IF NOT EXISTS transit_time_fallback (
	id INTEGER, 
	lead_time_days INTEGER DEFAULT 14 NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS transit_time_lanes (
	id INTEGER, 
	from_location_id INTEGER NOT NULL, 
	to_location_id INTEGER NOT NULL, 
	transport_mode TEXT NOT NULL, 
	lead_time_days INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(to_location_id) REFERENCES locations (id), 
	FOREIGN KEY(from_location_id) REFERENCES locations (id), 
	UNIQUE (from_location_id, to_location_id, transport_mode), 
	CHECK (transport_mode IN ('Air','Sea','Road'))
);
CREATE TABLE IF NOT EXISTS user_locations (
	user_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, location_id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS user_regions (
	user_id INTEGER NOT NULL, 
	region_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, region_id), 
	FOREIGN KEY(region_id) REFERENCES regions (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS user_roles (
	user_id INTEGER NOT NULL, 
	role_code TEXT NOT NULL, 
	assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (user_id, role_code), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE TABLE IF NOT EXISTS work_order_lines (
	id INTEGER, 
	work_order_id INTEGER NOT NULL, 
	outbound_order_line_id INTEGER, 
	allocated_serial_id INTEGER, 
	confirmed_serial_id INTEGER, 
	is_short_pick INTEGER DEFAULT 0 NOT NULL, 
	is_over_pick INTEGER DEFAULT 0 NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(confirmed_serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(allocated_serial_id) REFERENCES serial_numbers (id), 
	FOREIGN KEY(outbound_order_line_id) REFERENCES outbound_order_lines (id), 
	FOREIGN KEY(work_order_id) REFERENCES work_orders (id)
);
CREATE TABLE IF NOT EXISTS work_orders (
	id INTEGER, 
	order_number TEXT NOT NULL, 
	outbound_order_id INTEGER, 
	wo_type TEXT DEFAULT 'Pick' NOT NULL, 
	status TEXT DEFAULT 'Open' NOT NULL, 
	location_id INTEGER, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	FOREIGN KEY(location_id) REFERENCES locations (id), 
	FOREIGN KEY(outbound_order_id) REFERENCES outbound_orders (id), 
	UNIQUE (order_number)
);
