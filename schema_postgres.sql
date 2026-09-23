-- ============================================================================
-- Auto-generated Postgres schema — reflected from local dev terminal_tracking.db
-- Regenerate with: backend/tools/generate_pg_schema.py
-- Do not hand-edit; fix the source SQLite DB / ORM models and regenerate instead.
-- ============================================================================

CREATE TABLE IF NOT EXISTS accessories_inventory (
	id SERIAL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	state TEXT DEFAULT 'Available' NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (product_id, location_id, state)
);
CREATE TABLE IF NOT EXISTS accessory_reservations (
	id SERIAL, 
	order_id INTEGER NOT NULL, 
	order_line_id INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	status TEXT DEFAULT 'Reserved' NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	closed_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS activity_cost_master (
	id SERIAL NOT NULL, 
	location_code TEXT NOT NULL, 
	state_code TEXT NOT NULL, 
	product_code TEXT, 
	amount FLOAT NOT NULL, 
	currency TEXT NOT NULL, 
	active INTEGER NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS activity_costs (
	id SERIAL, 
	location_id INTEGER NOT NULL, 
	state_id INTEGER NOT NULL, 
	product_id INTEGER, 
	amount REAL NOT NULL, 
	currency TEXT NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS agent_allocation_intents (
	id SERIAL NOT NULL, 
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	executed_at TIMESTAMP WITHOUT TIME ZONE, 
	cancelled_at TIMESTAMP WITHOUT TIME ZONE, 
	cancelled_by_user_id INTEGER, 
	execution_do_refs TEXT, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS agent_logs (
	id SERIAL, 
	run_id TEXT NOT NULL, 
	agent_name TEXT NOT NULL, 
	step_type TEXT NOT NULL, 
	message TEXT, 
	order_ref TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS agent_recommendations (
	id SERIAL, 
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	actioned_at TIMESTAMP WITHOUT TIME ZONE, 
	actioned_by_user_id INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS agent_runs (
	id SERIAL NOT NULL, 
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
	started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (run_id)
);
CREATE TABLE IF NOT EXISTS ai_conversations (
	id SERIAL, 
	user_id INTEGER NOT NULL, 
	session_id TEXT NOT NULL, 
	page_context TEXT, 
	started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	ended_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (session_id)
);
CREATE TABLE IF NOT EXISTS ai_messages (
	id SERIAL, 
	conversation_id INTEGER NOT NULL, 
	role TEXT NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	CHECK (role IN ('user','assistant'))
);
CREATE TABLE IF NOT EXISTS alert_rules (
	id SERIAL NOT NULL, 
	rule_code TEXT NOT NULL, 
	name TEXT NOT NULL, 
	description TEXT, 
	enabled INTEGER NOT NULL, 
	threshold_urgent_days INTEGER, 
	threshold_critical_days INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (rule_code)
);
CREATE TABLE IF NOT EXISTS alerts (
	id SERIAL NOT NULL, 
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
	acknowledged_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS assembly_times (
	id SERIAL, 
	location_id INTEGER NOT NULL, 
	duration_days INTEGER DEFAULT 2 NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS atp_rules (
	id SERIAL, 
	region_id INTEGER, 
	segment_id INTEGER, 
	rule_key TEXT NOT NULL, 
	rule_value TEXT NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS business_calendar_holidays (
	id SERIAL, 
	calendar_id INTEGER NOT NULL, 
	holiday_date TEXT NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (calendar_id, holiday_date)
);
CREATE TABLE IF NOT EXISTS business_calendars (
	id SERIAL, 
	entity_type TEXT NOT NULL, 
	location_id INTEGER, 
	supplier_id INTEGER, 
	timezone TEXT DEFAULT 'UTC' NOT NULL, 
	working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri' NOT NULL, 
	work_hours_start TEXT DEFAULT '08:00' NOT NULL, 
	work_hours_end TEXT DEFAULT '17:00' NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS claim_attachments (
	id SERIAL NOT NULL, 
	claim_id INTEGER NOT NULL, 
	filename TEXT NOT NULL, 
	content_type TEXT, 
	data BYTEA NOT NULL, 
	uploaded_by_user_id INTEGER, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS claim_types (
	id SERIAL NOT NULL, 
	name TEXT NOT NULL, 
	description TEXT, 
	raised_against TEXT NOT NULL, 
	active INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS claims (
	id SERIAL NOT NULL, 
	claim_number TEXT NOT NULL, 
	po_id INTEGER, 
	serial_id INTEGER, 
	claim_type_id INTEGER NOT NULL, 
	raised_against TEXT NOT NULL, 
	status TEXT NOT NULL, 
	description TEXT, 
	resolution_notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	urgency TEXT DEFAULT 'Normal' NOT NULL, 
	outbound_order_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (claim_number)
);
CREATE TABLE IF NOT EXISTS countries (
	id SERIAL, 
	country_code TEXT NOT NULL, 
	country_name TEXT NOT NULL, 
	region_id INTEGER NOT NULL, 
	serviced INTEGER DEFAULT 0 NOT NULL, 
	activated_at TIMESTAMP WITHOUT TIME ZONE, 
	currency TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (country_code)
);
CREATE TABLE IF NOT EXISTS customer_segments (
	id SERIAL, 
	segment_code TEXT NOT NULL, 
	segment_name TEXT NOT NULL, 
	priority INTEGER DEFAULT 99 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (segment_code)
);
CREATE TABLE IF NOT EXISTS customers (
	id SERIAL, 
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
	UNIQUE (customer_ref), 
	CHECK (customer_type IN ('Shop','Merchant','Distributor','Partner'))
);
CREATE TABLE IF NOT EXISTS demand_signals (
	id SERIAL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER, 
	period_date TEXT NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS distribution_order_lines (
	id SERIAL, 
	dist_order_id INTEGER NOT NULL, 
	line_id TEXT, 
	product_id INTEGER, 
	quantity INTEGER NOT NULL, 
	stock TEXT, 
	product_state TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (dist_order_id, line_id)
);
CREATE TABLE IF NOT EXISTS distribution_order_nonserial (
	id SERIAL, 
	dist_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS distribution_order_serials (
	id SERIAL, 
	dist_order_id INTEGER NOT NULL, 
	shipped_line_id TEXT, 
	serial_id INTEGER, 
	security_seal TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (dist_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS distribution_orders (
	id SERIAL, 
	order_number TEXT NOT NULL, 
	distribution_reference TEXT, 
	environment TEXT DEFAULT 'Live', 
	inbound_state TEXT, 
	origin_location_id INTEGER, 
	destination_location_id INTEGER, 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	shipped_at TIMESTAMP WITHOUT TIME ZONE, 
	delivered_at TIMESTAMP WITHOUT TIME ZONE, 
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
	inbounded_at TIMESTAMP WITHOUT TIME ZONE, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (order_number)
);
CREATE TABLE IF NOT EXISTS distribution_received (
	id SERIAL, 
	dist_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	product_state TEXT, 
	serials TEXT, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS exchange_rate_master (
	id SERIAL NOT NULL, 
	from_currency TEXT NOT NULL, 
	to_currency TEXT NOT NULL, 
	rate FLOAT NOT NULL, 
	effective_date TEXT NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS exchange_rates (
	id SERIAL, 
	from_currency TEXT NOT NULL, 
	to_currency TEXT NOT NULL, 
	rate REAL NOT NULL, 
	effective_date DATE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (from_currency, to_currency, effective_date)
);
CREATE TABLE IF NOT EXISTS firmware (
	id SERIAL, 
	firmware_name TEXT NOT NULL, 
	version TEXT NOT NULL, 
	release_number TEXT, 
	release_date DATE, 
	release_hour TEXT, 
	key_used TEXT, 
	file_path TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	product_id INTEGER, 
	active INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (firmware_name, version, release_number)
);
CREATE TABLE IF NOT EXISTS flow_constraints (
	id SERIAL, 
	flow_id INTEGER NOT NULL, 
	product_id INTEGER, 
	replenishment_type TEXT, 
	valid_from DATE, 
	valid_to DATE, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS goods_receipt_messages (
	id SERIAL NOT NULL, 
	po_id INTEGER, 
	location_id INTEGER NOT NULL, 
	message_type TEXT NOT NULL, 
	serial_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	created_by_user_id INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS inbound_shipments (
	id SERIAL, 
	po_id INTEGER NOT NULL, 
	shipment_reference TEXT, 
	carrier TEXT, 
	carrier_tracking_ref TEXT, 
	estimated_arrival_date DATE, 
	uploaded_by_user_id INTEGER, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS location_types (
	id SERIAL, 
	name TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	gr_applicable INTEGER DEFAULT 1 NOT NULL, 
	accruals_applicable TEXT DEFAULT 'NA' NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS locations (
	id SERIAL, 
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
	UNIQUE (code)
);
CREATE TABLE IF NOT EXISTS mass_upload_log (
	id SERIAL, 
	upload_type TEXT NOT NULL, 
	uploaded_by_user_id INTEGER, 
	filename TEXT, 
	total_records INTEGER DEFAULT 0 NOT NULL, 
	successful_records INTEGER DEFAULT 0 NOT NULL, 
	failed_records INTEGER DEFAULT 0 NOT NULL, 
	error_report TEXT, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS network_versions (
	id SERIAL, 
	version_name TEXT NOT NULL, 
	version_type TEXT NOT NULL, 
	reference_number TEXT, 
	effective_date DATE, 
	committed_at TIMESTAMP WITHOUT TIME ZONE, 
	committed_by_user_id INTEGER, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	is_current INTEGER DEFAULT 0 NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (version_type IN ('baseline','simulation'))
);
CREATE TABLE IF NOT EXISTS non_serialised_inventory (
	id SERIAL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	state TEXT DEFAULT 'Available' NOT NULL, 
	quantity INTEGER DEFAULT 0 NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (product_id, location_id, state), 
	CHECK (state IN ('Received','Available'))
);
CREATE TABLE IF NOT EXISTS order_numbering (
	id SERIAL, 
	order_type TEXT NOT NULL, 
	prefix TEXT NOT NULL, 
	padding_length INTEGER DEFAULT 6 NOT NULL, 
	current_sequence INTEGER DEFAULT 0 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (order_type)
);
CREATE TABLE IF NOT EXISTS outbound_order_lines (
	id SERIAL, 
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
	UNIQUE (order_id, line_number)
);
CREATE TABLE IF NOT EXISTS outbound_order_nonserial (
	id SERIAL, 
	order_id INTEGER NOT NULL, 
	order_line_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (order_id, order_line_id, product_id)
);
CREATE TABLE IF NOT EXISTS outbound_order_serials (
	id SERIAL, 
	order_id INTEGER NOT NULL, 
	order_line_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	shipped_line_id TEXT, 
	security_seal TEXT, 
	iccid TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS outbound_orders (
	id SERIAL, 
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
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
	UNIQUE (order_number), 
	CHECK (order_type IN ('Sales','Rental','Replacement','Distribution')), 
	CHECK (status IN ('Draft','Issued','Allocated','In Picking','Shipped','Delivered','Closed','Delivery Failed','Cancelled'))
);
CREATE TABLE IF NOT EXISTS product_alternatives (
	id SERIAL, 
	product_id INTEGER NOT NULL, 
	alternative_product_id INTEGER NOT NULL, 
	sequence INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (product_id, alternative_product_id), 
	CHECK (product_id != alternative_product_id)
);
CREATE TABLE IF NOT EXISTS product_bom_components (
	id SERIAL, 
	parent_product_id INTEGER NOT NULL, 
	component_product_id INTEGER NOT NULL, 
	quantity INTEGER DEFAULT 1 NOT NULL, 
	assembly_leadtime_value INTEGER, 
	assembly_leadtime_unit TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (parent_product_id, component_product_id), 
	CHECK (parent_product_id != component_product_id)
);
CREATE TABLE IF NOT EXISTS product_countries (
	product_id INTEGER NOT NULL, 
	country_code TEXT NOT NULL, 
	PRIMARY KEY (product_id, country_code)
);
CREATE TABLE IF NOT EXISTS product_interchangeable (
	product_id INTEGER NOT NULL, 
	interchangeable_product_id INTEGER NOT NULL, 
	PRIMARY KEY (product_id, interchangeable_product_id), 
	CHECK (product_id != interchangeable_product_id)
);
CREATE TABLE IF NOT EXISTS product_pricing (
	id SERIAL, 
	product_id INTEGER NOT NULL, 
	region_id INTEGER, 
	country_id INTEGER, 
	sell_price REAL, 
	rental_price_month REAL, 
	currency TEXT NOT NULL, 
	effective_date DATE, 
	PRIMARY KEY (id), 
	UNIQUE (product_id, region_id, country_id)
);
CREATE TABLE IF NOT EXISTS product_repair_centres (
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	PRIMARY KEY (product_id, location_id)
);
CREATE TABLE IF NOT EXISTS product_suppliers (
	product_id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	lead_time_days INTEGER, 
	PRIMARY KEY (product_id, supplier_id)
);
CREATE TABLE IF NOT EXISTS products (
	id SERIAL, 
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
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	battery_life_days INTEGER, 
	warranty_days INTEGER, 
	repair_max_days INTEGER, 
	image_data BYTEA, 
	image_content_type TEXT, 
	latest_firmware_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (code), 
	CHECK (product_type IN ('Payment Terminal','Accessory','Battery')), 
	CHECK (product_category IN ('PaymentDevice','SerializedAccessory','Accessory'))
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
	id SERIAL, 
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
	UNIQUE (po_id, line_number)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
	id SERIAL, 
	po_number TEXT NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	destination_location_id INTEGER NOT NULL, 
	order_date DATE NOT NULL, 
	expected_arrival_date DATE, 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	received_date TEXT, 
	external_reference TEXT, 
	partial_order TEXT, 
	environment TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (po_number), 
	CHECK (status IN ('Draft','Issued','Expected','Partially Received','Fully Received','Closed','Cancelled'))
);
CREATE TABLE IF NOT EXISTS regions (
	id SERIAL, 
	region_code TEXT NOT NULL, 
	region_name TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (region_code)
);
CREATE TABLE IF NOT EXISTS repair_order_documents (
	id SERIAL, 
	repair_order_id INTEGER NOT NULL, 
	file_name TEXT NOT NULL, 
	content_type TEXT, 
	data BYTEA NOT NULL, 
	file_size_bytes INTEGER, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	uploaded_by_user_id INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS repair_order_serials (
	id SERIAL, 
	repair_order_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (repair_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS repair_orders (
	id SERIAL, 
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (order_number), 
	CHECK (status IN ('Dispatched','Received at Repair Centre','In Repair','Completed','Returned')), 
	CHECK (outcome IN ('Repaired','Beyond Repair'))
);
CREATE TABLE IF NOT EXISTS repair_rework_orders (
	id SERIAL, 
	order_number TEXT NOT NULL, 
	location_id INTEGER, 
	external_reference TEXT, 
	dispatch_type TEXT DEFAULT 'Repair' NOT NULL, 
	reason TEXT, 
	environment TEXT DEFAULT 'Live', 
	status TEXT DEFAULT 'Draft' NOT NULL, 
	outbound_shipped_at TIMESTAMP WITHOUT TIME ZONE, 
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
	inbound_shipped_at TIMESTAMP WITHOUT TIME ZONE, 
	inbound_key TEXT, 
	inbounded_at TIMESTAMP WITHOUT TIME ZONE, 
	estimated_return_date TEXT, 
	actual_return_date TEXT, 
	return_location_id INTEGER, 
	outcome TEXT, 
	actual_cost REAL, 
	actual_cost_currency TEXT, 
	repair_notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	rma_reference TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (order_number)
);
CREATE TABLE IF NOT EXISTS repair_rework_received (
	id SERIAL, 
	rr_order_id INTEGER NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	product_state TEXT, 
	serials TEXT, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS repair_rework_serials (
	id SERIAL, 
	rr_order_id INTEGER NOT NULL, 
	serial_id INTEGER, 
	product_code TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (rr_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS return_order_serials (
	id SERIAL, 
	return_order_id INTEGER NOT NULL, 
	serial_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (return_order_id, serial_id)
);
CREATE TABLE IF NOT EXISTS return_orders (
	id SERIAL, 
	order_number TEXT NOT NULL, 
	original_order_id INTEGER, 
	customer_id INTEGER, 
	reason TEXT NOT NULL, 
	status TEXT DEFAULT 'Initiated' NOT NULL, 
	inspection_outcome TEXT, 
	linked_replacement_order_id INTEGER, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	linked_rr_order_id INTEGER, 
	rma_reference TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (order_number), 
	CHECK (reason IN ('Defective','End of Rental','End of Lifecycle','Wrong Item','Other')), 
	CHECK (status IN ('Initiated','In Transit','Received','Inspected','Closed')), 
	CHECK (inspection_outcome IN ('Defective','Scrap'))
);
CREATE TABLE IF NOT EXISTS safety_stock_targets (
	id SERIAL NOT NULL, 
	product_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	min_qty INTEGER NOT NULL, 
	reorder_point INTEGER NOT NULL, 
	reorder_qty INTEGER NOT NULL, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS serial_import_batches (
	id SERIAL, 
	po_id INTEGER NOT NULL, 
	po_line_id INTEGER NOT NULL, 
	shipment_reference TEXT NOT NULL, 
	source_type TEXT NOT NULL, 
	document_file_path TEXT, 
	status TEXT DEFAULT 'Pending' NOT NULL, 
	confirmed_at TIMESTAMP WITHOUT TIME ZONE, 
	imported_by_user_id INTEGER, 
	imported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	CHECK (source_type IN ('manual','ai_document','excel')), 
	CHECK (status IN ('Pending','Confirmed','Rejected'))
);
CREATE TABLE IF NOT EXISTS serial_numbers (
	id SERIAL, 
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
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
	firmware_applied_at TIMESTAMP WITHOUT TIME ZONE, 
	pegged_to_order_id INTEGER, 
	import_batch_id INTEGER, 
	shipment_reference TEXT, 
	carrier TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (serial_number, supplier_id), 
	CHECK (stock_type IN ('Live','Refurbished','Returned','Test'))
);
CREATE TABLE IF NOT EXISTS state_history (
	id SERIAL, 
	serial_number_id INTEGER NOT NULL, 
	state_id INTEGER NOT NULL, 
	location_id INTEGER, 
	datetime_utc TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, 
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
	CHECK (actor_type IN ('user','api','system'))
);
CREATE TABLE IF NOT EXISTS state_transitions (
	id SERIAL, 
	from_state_id INTEGER, 
	to_state_id INTEGER NOT NULL, 
	acting_role TEXT NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (from_state_id, to_state_id, acting_role)
);
CREATE TABLE IF NOT EXISTS state_valid_location_types (
	state_id INTEGER NOT NULL, 
	location_type_id INTEGER NOT NULL, 
	PRIMARY KEY (state_id, location_type_id)
);
CREATE TABLE IF NOT EXISTS supplier_users (
	user_id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, supplier_id)
);
CREATE TABLE IF NOT EXISTS suppliers (
	id SERIAL, 
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
CREATE TABLE IF NOT EXISTS supply_flows (
	id SERIAL, 
	network_version_id INTEGER NOT NULL, 
	from_location_id INTEGER, 
	from_supplier_id INTEGER, 
	to_location_id INTEGER, 
	to_supplier_id INTEGER, 
	flow_type TEXT NOT NULL, 
	active INTEGER DEFAULT 1 NOT NULL, 
	lead_time REAL, 
	lead_time_unit TEXT DEFAULT 'days' NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS system_config (
	id SERIAL, 
	config_key TEXT NOT NULL, 
	label TEXT NOT NULL, 
	description TEXT, 
	data_type TEXT NOT NULL, 
	current_value TEXT, 
	default_value TEXT, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_by_user_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (config_key), 
	CHECK (data_type IN ('string','integer','boolean','decimal'))
);
CREATE TABLE IF NOT EXISTS terminal_states (
	id SERIAL, 
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
CREATE TABLE IF NOT EXISTS transit_time_fallback (
	id SERIAL, 
	lead_time_days INTEGER DEFAULT 14 NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS transit_time_lanes (
	id SERIAL, 
	from_location_id INTEGER NOT NULL, 
	to_location_id INTEGER NOT NULL, 
	transport_mode TEXT NOT NULL, 
	lead_time_days INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (from_location_id, to_location_id, transport_mode), 
	CHECK (transport_mode IN ('Air','Sea','Road'))
);
CREATE TABLE IF NOT EXISTS user_locations (
	user_id INTEGER NOT NULL, 
	location_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, location_id)
);
CREATE TABLE IF NOT EXISTS user_regions (
	user_id INTEGER NOT NULL, 
	region_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, region_id)
);
CREATE TABLE IF NOT EXISTS user_roles (
	user_id INTEGER NOT NULL, 
	role_code TEXT NOT NULL, 
	assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (user_id, role_code)
);
CREATE TABLE IF NOT EXISTS users (
	id SERIAL, 
	username TEXT NOT NULL, 
	email TEXT, 
	password_hash TEXT NOT NULL, 
	role TEXT NOT NULL, 
	default_location_id INTEGER, 
	active INTEGER DEFAULT 1 NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	supplier_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (username), 
	UNIQUE (email), 
	CHECK (role IN (
                                    'admin','supply_planner','warehouse_user',
                                    'repair_centre','supplier','demand_planner'
                                ))
);
CREATE TABLE IF NOT EXISTS work_order_lines (
	id SERIAL, 
	work_order_id INTEGER NOT NULL, 
	outbound_order_line_id INTEGER, 
	allocated_serial_id INTEGER, 
	confirmed_serial_id INTEGER, 
	is_short_pick INTEGER DEFAULT 0 NOT NULL, 
	is_over_pick INTEGER DEFAULT 0 NOT NULL, 
	product_id INTEGER, 
	quantity INTEGER, 
	confirmed_quantity INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS work_orders (
	id SERIAL, 
	order_number TEXT NOT NULL, 
	outbound_order_id INTEGER, 
	wo_type TEXT DEFAULT 'Pick' NOT NULL, 
	status TEXT DEFAULT 'Open' NOT NULL, 
	location_id INTEGER, 
	notes TEXT, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	requires_assembly INTEGER DEFAULT 0 NOT NULL, 
	assembly_confirmed_at TIMESTAMP WITHOUT TIME ZONE, 
	assembly_confirmed_by_user_id INTEGER, 
	production_minutes INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (order_number)
);

-- Columns added to existing tables (no-ops when already present)
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Available' NOT NULL;
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS order_id INTEGER;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS order_line_id INTEGER;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Reserved' NOT NULL;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE accessory_reservations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS location_code TEXT;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS amount FLOAT;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE activity_cost_master ADD COLUMN IF NOT EXISTS active INTEGER;
ALTER TABLE activity_costs ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE activity_costs ADD COLUMN IF NOT EXISTS state_id INTEGER;
ALTER TABLE activity_costs ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE activity_costs ADD COLUMN IF NOT EXISTS amount REAL;
ALTER TABLE activity_costs ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS from_location_id INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS to_location_id INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS reserved_qty INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS remaining_qty INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS horizon_days INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS cancelled_by_user_id INTEGER;
ALTER TABLE agent_allocation_intents ADD COLUMN IF NOT EXISTS execution_do_refs TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS step_type TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS order_ref TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS rec_type TEXT;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS from_location_id INTEGER;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS to_location_id INTEGER;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS qty INTEGER;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS shortage_qty INTEGER;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS estimated_value REAL;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending' NOT NULL;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS order_ref TEXT;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS actioned_by_user_id INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS triggered_by TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS shortages_found INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS actions_taken INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS hitl_items INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS intents_recorded INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS intents_executed INTEGER;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS summary_text TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS page_context TEXT;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS rule_code TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS enabled INTEGER;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold_urgent_days INTEGER;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold_critical_days INTEGER;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rule_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reference_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS days_overdue INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by_user_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE assembly_times ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE assembly_times ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 2 NOT NULL;
ALTER TABLE atp_rules ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE atp_rules ADD COLUMN IF NOT EXISTS segment_id INTEGER;
ALTER TABLE atp_rules ADD COLUMN IF NOT EXISTS rule_key TEXT;
ALTER TABLE atp_rules ADD COLUMN IF NOT EXISTS rule_value TEXT;
ALTER TABLE atp_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE business_calendar_holidays ADD COLUMN IF NOT EXISTS calendar_id INTEGER;
ALTER TABLE business_calendar_holidays ADD COLUMN IF NOT EXISTS holiday_date TEXT;
ALTER TABLE business_calendar_holidays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC' NOT NULL;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri' NOT NULL;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS work_hours_start TEXT DEFAULT '08:00' NOT NULL;
ALTER TABLE business_calendars ADD COLUMN IF NOT EXISTS work_hours_end TEXT DEFAULT '17:00' NOT NULL;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS claim_id INTEGER;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER;
ALTER TABLE claim_attachments ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE claim_types ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE claim_types ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE claim_types ADD COLUMN IF NOT EXISTS raised_against TEXT;
ALTER TABLE claim_types ADD COLUMN IF NOT EXISTS active INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_number TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_type_id INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS raised_against TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'Normal' NOT NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS outbound_order_id INTEGER;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS country_name TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS serviced INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE customer_segments ADD COLUMN IF NOT EXISTS segment_code TEXT;
ALTER TABLE customer_segments ADD COLUMN IF NOT EXISTS segment_name TEXT;
ALTER TABLE customer_segments ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 99 NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_ref TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS duns_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state_region TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_rating TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment_id INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country_id INTEGER;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS period_date TEXT;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE demand_signals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS dist_order_id INTEGER;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS stock TEXT;
ALTER TABLE distribution_order_lines ADD COLUMN IF NOT EXISTS product_state TEXT;
ALTER TABLE distribution_order_nonserial ADD COLUMN IF NOT EXISTS dist_order_id INTEGER;
ALTER TABLE distribution_order_nonserial ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE distribution_order_nonserial ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE distribution_order_serials ADD COLUMN IF NOT EXISTS dist_order_id INTEGER;
ALTER TABLE distribution_order_serials ADD COLUMN IF NOT EXISTS shipped_line_id TEXT;
ALTER TABLE distribution_order_serials ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE distribution_order_serials ADD COLUMN IF NOT EXISTS security_seal TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS distribution_reference TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'Live';
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS inbound_state TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS origin_location_id INTEGER;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS destination_location_id INTEGER;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft' NOT NULL;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_company TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_first_name TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_last_name TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_phone TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_email TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_line1 TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_line2 TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_city TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_postal TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_state TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_from_addr_country TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_company TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_first_name TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_last_name TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_phone TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_email TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_line1 TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_line2 TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_city TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_postal TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_state TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS ship_to_addr_country TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS tracking_type TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS inbound_key TEXT;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS inbounded_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE distribution_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE distribution_received ADD COLUMN IF NOT EXISTS dist_order_id INTEGER;
ALTER TABLE distribution_received ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE distribution_received ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE distribution_received ADD COLUMN IF NOT EXISTS product_state TEXT;
ALTER TABLE distribution_received ADD COLUMN IF NOT EXISTS serials TEXT;
ALTER TABLE exchange_rate_master ADD COLUMN IF NOT EXISTS from_currency TEXT;
ALTER TABLE exchange_rate_master ADD COLUMN IF NOT EXISTS to_currency TEXT;
ALTER TABLE exchange_rate_master ADD COLUMN IF NOT EXISTS rate FLOAT;
ALTER TABLE exchange_rate_master ADD COLUMN IF NOT EXISTS effective_date TEXT;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS from_currency TEXT;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS to_currency TEXT;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate REAL;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS firmware_name TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS version TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS release_number TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS release_date DATE;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS release_hour TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS key_used TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE firmware ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE flow_constraints ADD COLUMN IF NOT EXISTS flow_id INTEGER;
ALTER TABLE flow_constraints ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE flow_constraints ADD COLUMN IF NOT EXISTS replenishment_type TEXT;
ALTER TABLE flow_constraints ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE flow_constraints ADD COLUMN IF NOT EXISTS valid_to DATE;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS serial_count INTEGER;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE goods_receipt_messages ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS shipment_reference TEXT;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS carrier_tracking_ref TEXT;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER;
ALTER TABLE inbound_shipments ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE location_types ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE location_types ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE location_types ADD COLUMN IF NOT EXISTS gr_applicable INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE location_types ADD COLUMN IF NOT EXISTS accruals_applicable TEXT DEFAULT 'NA' NOT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_type_id INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS reporting_currency TEXT DEFAULT 'EUR' NOT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS country_id INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS upload_type TEXT;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS successful_records INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS failed_records INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS error_report TEXT;
ALTER TABLE mass_upload_log ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS version_name TEXT;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS version_type TEXT;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS committed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS committed_by_user_id INTEGER;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE network_versions ADD COLUMN IF NOT EXISTS is_current INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE non_serialised_inventory ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE non_serialised_inventory ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE non_serialised_inventory ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Available' NOT NULL;
ALTER TABLE non_serialised_inventory ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE non_serialised_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE order_numbering ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE order_numbering ADD COLUMN IF NOT EXISTS prefix TEXT;
ALTER TABLE order_numbering ADD COLUMN IF NOT EXISTS padding_length INTEGER DEFAULT 6 NOT NULL;
ALTER TABLE order_numbering ADD COLUMN IF NOT EXISTS current_sequence INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS order_id INTEGER;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS line_number INTEGER;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS fulfilling_location_id INTEGER;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS edd DATE;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS atp_status TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS bom_assembly_status TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS component_transfer_orders TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS atp_reasoning TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS atp_split_details TEXT;
ALTER TABLE outbound_order_nonserial ADD COLUMN IF NOT EXISTS order_id INTEGER;
ALTER TABLE outbound_order_nonserial ADD COLUMN IF NOT EXISTS order_line_id INTEGER;
ALTER TABLE outbound_order_nonserial ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE outbound_order_nonserial ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS order_id INTEGER;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS order_line_id INTEGER;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS shipped_line_id TEXT;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS security_seal TEXT;
ALTER TABLE outbound_order_serials ADD COLUMN IF NOT EXISTS iccid TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft' NOT NULL;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS destination_location_id INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS atp_ship_date DATE;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS atp_delivery_date DATE;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS atp_feasible INTEGER DEFAULT 1;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS fulfilling_location_id INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS shipped_date DATE;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS shipping_cost REAL;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS shipping_cost_currency TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS rental_period_months INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS rental_fee REAL;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS rental_fee_currency TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS rental_expected_return_date DATE;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS linked_return_order_id INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS order_state TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS merchant_reference TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS stock TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS location_code TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS company_account TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS environment TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_company TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_vat_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_reg_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_phone TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_line1 TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_line2 TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_city TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_postal TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_state TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_from_addr_country TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_company TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_attention TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_vat_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_phone TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_line1 TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_line2 TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_city TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_postal TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_state TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS inv_to_addr_country TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tracking_type TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS shipment_vat_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS allocation_source_order_id INTEGER;
ALTER TABLE product_alternatives ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE product_alternatives ADD COLUMN IF NOT EXISTS alternative_product_id INTEGER;
ALTER TABLE product_alternatives ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE product_bom_components ADD COLUMN IF NOT EXISTS parent_product_id INTEGER;
ALTER TABLE product_bom_components ADD COLUMN IF NOT EXISTS component_product_id INTEGER;
ALTER TABLE product_bom_components ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE product_bom_components ADD COLUMN IF NOT EXISTS assembly_leadtime_value INTEGER;
ALTER TABLE product_bom_components ADD COLUMN IF NOT EXISTS assembly_leadtime_unit TEXT;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS country_id INTEGER;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS sell_price REAL;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS rental_price_month REAL;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE product_suppliers ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS serialised INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bom INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_value REAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_currency TEXT DEFAULT 'EUR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS refurb_unit_value REAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS refurb_unit_currency TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hs_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_keyloaded INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_value_symbol TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_value_decimals INTEGER DEFAULT 2;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_value_display TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS battery_life_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS repair_max_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_content_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS latest_firmware_id INTEGER;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS line_number INTEGER;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS qty_ordered INTEGER;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS qty_expected INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS qty_received INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS received_date TEXT;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS price_per_product REAL;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS price_currency TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS destination_location_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_arrival_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft' NOT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_date TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS partial_order TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS environment TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS region_name TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS repair_order_id INTEGER;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE repair_order_documents ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER;
ALTER TABLE repair_order_serials ADD COLUMN IF NOT EXISTS repair_order_id INTEGER;
ALTER TABLE repair_order_serials ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS return_order_id INTEGER;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS repair_centre_location_id INTEGER;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS estimated_return_date DATE;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS actual_return_date DATE;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS return_location_id INTEGER;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Dispatched' NOT NULL;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS actual_cost REAL;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS actual_cost_currency TEXT;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS repair_notes TEXT;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS dispatch_type TEXT DEFAULT 'Repair' NOT NULL;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'Live';
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft' NOT NULL;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS outbound_shipped_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_first_name TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_last_name TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_company TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_phone TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_email TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_addr_line1 TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_addr_city TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_addr_postal TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_addr_state TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS ship_to_addr_country TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS tracking_type TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS inbound_shipped_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS inbound_key TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS inbounded_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS estimated_return_date TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS actual_return_date TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS return_location_id INTEGER;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS actual_cost REAL;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS actual_cost_currency TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS repair_notes TEXT;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE repair_rework_orders ADD COLUMN IF NOT EXISTS rma_reference TEXT;
ALTER TABLE repair_rework_received ADD COLUMN IF NOT EXISTS rr_order_id INTEGER;
ALTER TABLE repair_rework_received ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE repair_rework_received ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE repair_rework_received ADD COLUMN IF NOT EXISTS product_state TEXT;
ALTER TABLE repair_rework_received ADD COLUMN IF NOT EXISTS serials TEXT;
ALTER TABLE repair_rework_serials ADD COLUMN IF NOT EXISTS rr_order_id INTEGER;
ALTER TABLE repair_rework_serials ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE repair_rework_serials ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE return_order_serials ADD COLUMN IF NOT EXISTS return_order_id INTEGER;
ALTER TABLE return_order_serials ADD COLUMN IF NOT EXISTS serial_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS original_order_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Initiated' NOT NULL;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS inspection_outcome TEXT;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS linked_replacement_order_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS linked_rr_order_id INTEGER;
ALTER TABLE return_orders ADD COLUMN IF NOT EXISTS rma_reference TEXT;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS min_qty INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS reorder_point INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS reorder_qty INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE safety_stock_targets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS po_line_id INTEGER;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS shipment_reference TEXT;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS document_file_path TEXT;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending' NOT NULL;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS imported_by_user_id INTEGER;
ALTER TABLE serial_import_batches ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS current_state_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS current_location_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS stock_type TEXT DEFAULT 'Live' NOT NULL;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS security_seal INTEGER DEFAULT 0;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS key_loaded INTEGER DEFAULT 0;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS po_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS po_line_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS accumulated_cost REAL DEFAULT 0;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS terminal_type TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS wifi_mac TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS bluetooth_mac TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS ethernet_mac TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS imei1 TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS imei2 TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS iccid TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS eid TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS key_id TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS firmware_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS firmware_applied_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS pegged_to_order_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS import_batch_id INTEGER;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS shipment_reference TEXT;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS serial_number_id INTEGER;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS state_id INTEGER;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS datetime_utc TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC' NOT NULL;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS actor_type TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS actor_user_id INTEGER;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS activity_description TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS order_reference TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS activity_cost REAL;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS activity_cost_currency TEXT;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS reporting_currency_equiv REAL;
ALTER TABLE state_history ADD COLUMN IF NOT EXISTS exchange_rate_applied REAL;
ALTER TABLE state_transitions ADD COLUMN IF NOT EXISTS from_state_id INTEGER;
ALTER TABLE state_transitions ADD COLUMN IF NOT EXISTS to_state_id INTEGER;
ALTER TABLE state_transitions ADD COLUMN IF NOT EXISTS acting_role TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS network_version_id INTEGER;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS from_location_id INTEGER;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS from_supplier_id INTEGER;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS to_location_id INTEGER;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS to_supplier_id INTEGER;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS flow_type TEXT;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS lead_time REAL;
ALTER TABLE supply_flows ADD COLUMN IF NOT EXISTS lead_time_unit TEXT DEFAULT 'days' NOT NULL;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS config_key TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS data_type TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS current_value TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS default_value TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS warehouse_type TEXT;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS expected_duration_value REAL;
ALTER TABLE terminal_states ADD COLUMN IF NOT EXISTS expected_duration_unit TEXT;
ALTER TABLE transit_time_fallback ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 14 NOT NULL;
ALTER TABLE transit_time_lanes ADD COLUMN IF NOT EXISTS from_location_id INTEGER;
ALTER TABLE transit_time_lanes ADD COLUMN IF NOT EXISTS to_location_id INTEGER;
ALTER TABLE transit_time_lanes ADD COLUMN IF NOT EXISTS transport_mode TEXT;
ALTER TABLE transit_time_lanes ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_location_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS work_order_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS outbound_order_line_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS allocated_serial_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS confirmed_serial_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS is_short_pick INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS is_over_pick INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS confirmed_quantity INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS outbound_order_id INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS wo_type TEXT DEFAULT 'Pick' NOT NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open' NOT NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS requires_assembly INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assembly_confirmed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assembly_confirmed_by_user_id INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS production_minutes INTEGER;

-- Foreign Keys
ALTER TABLE accessories_inventory ADD CONSTRAINT fk_accessories_inventory_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE accessories_inventory ADD CONSTRAINT fk_accessories_inventory_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE accessory_reservations ADD CONSTRAINT fk_accessory_reservations_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE accessory_reservations ADD CONSTRAINT fk_accessory_reservations_2 FOREIGN KEY (order_id) REFERENCES outbound_orders (id);
ALTER TABLE accessory_reservations ADD CONSTRAINT fk_accessory_reservations_3 FOREIGN KEY (order_line_id) REFERENCES outbound_order_lines (id);
ALTER TABLE accessory_reservations ADD CONSTRAINT fk_accessory_reservations_4 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE activity_costs ADD CONSTRAINT fk_activity_costs_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE activity_costs ADD CONSTRAINT fk_activity_costs_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE activity_costs ADD CONSTRAINT fk_activity_costs_3 FOREIGN KEY (state_id) REFERENCES terminal_states (id);
ALTER TABLE agent_allocation_intents ADD CONSTRAINT fk_agent_allocation_intents_1 FOREIGN KEY (cancelled_by_user_id) REFERENCES users (id);
ALTER TABLE agent_allocation_intents ADD CONSTRAINT fk_agent_allocation_intents_2 FOREIGN KEY (from_location_id) REFERENCES locations (id);
ALTER TABLE agent_allocation_intents ADD CONSTRAINT fk_agent_allocation_intents_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE agent_allocation_intents ADD CONSTRAINT fk_agent_allocation_intents_4 FOREIGN KEY (to_location_id) REFERENCES locations (id);
ALTER TABLE agent_recommendations ADD CONSTRAINT fk_agent_recommendations_1 FOREIGN KEY (actioned_by_user_id) REFERENCES users (id);
ALTER TABLE agent_recommendations ADD CONSTRAINT fk_agent_recommendations_2 FOREIGN KEY (from_location_id) REFERENCES locations (id);
ALTER TABLE agent_recommendations ADD CONSTRAINT fk_agent_recommendations_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE agent_recommendations ADD CONSTRAINT fk_agent_recommendations_4 FOREIGN KEY (to_location_id) REFERENCES locations (id);
ALTER TABLE ai_conversations ADD CONSTRAINT fk_ai_conversations_1 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE ai_messages ADD CONSTRAINT fk_ai_messages_1 FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_1 FOREIGN KEY (acknowledged_by_user_id) REFERENCES users (id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_4 FOREIGN KEY (rule_id) REFERENCES alert_rules (id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_5 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE assembly_times ADD CONSTRAINT fk_assembly_times_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE atp_rules ADD CONSTRAINT fk_atp_rules_1 FOREIGN KEY (region_id) REFERENCES regions (id);
ALTER TABLE atp_rules ADD CONSTRAINT fk_atp_rules_2 FOREIGN KEY (segment_id) REFERENCES customer_segments (id);
ALTER TABLE business_calendar_holidays ADD CONSTRAINT fk_business_calendar_holidays_1 FOREIGN KEY (calendar_id) REFERENCES business_calendars (id);
ALTER TABLE business_calendars ADD CONSTRAINT fk_business_calendars_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE business_calendars ADD CONSTRAINT fk_business_calendars_2 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE claim_attachments ADD CONSTRAINT fk_claim_attachments_1 FOREIGN KEY (claim_id) REFERENCES claims (id);
ALTER TABLE claim_attachments ADD CONSTRAINT fk_claim_attachments_2 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id);
ALTER TABLE claims ADD CONSTRAINT fk_claims_1 FOREIGN KEY (claim_type_id) REFERENCES claim_types (id);
ALTER TABLE claims ADD CONSTRAINT fk_claims_2 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE claims ADD CONSTRAINT fk_claims_3 FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders (id);
ALTER TABLE claims ADD CONSTRAINT fk_claims_4 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE claims ADD CONSTRAINT fk_claims_5 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE countries ADD CONSTRAINT fk_countries_1 FOREIGN KEY (region_id) REFERENCES regions (id);
ALTER TABLE customers ADD CONSTRAINT fk_customers_1 FOREIGN KEY (country_id) REFERENCES countries (id);
ALTER TABLE customers ADD CONSTRAINT fk_customers_2 FOREIGN KEY (segment_id) REFERENCES customer_segments (id);
ALTER TABLE demand_signals ADD CONSTRAINT fk_demand_signals_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE demand_signals ADD CONSTRAINT fk_demand_signals_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE demand_signals ADD CONSTRAINT fk_demand_signals_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE distribution_order_lines ADD CONSTRAINT fk_distribution_order_lines_1 FOREIGN KEY (dist_order_id) REFERENCES distribution_orders (id);
ALTER TABLE distribution_order_lines ADD CONSTRAINT fk_distribution_order_lines_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE distribution_order_nonserial ADD CONSTRAINT fk_distribution_order_nonserial_1 FOREIGN KEY (dist_order_id) REFERENCES distribution_orders (id);
ALTER TABLE distribution_order_nonserial ADD CONSTRAINT fk_distribution_order_nonserial_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE distribution_order_serials ADD CONSTRAINT fk_distribution_order_serials_1 FOREIGN KEY (dist_order_id) REFERENCES distribution_orders (id);
ALTER TABLE distribution_order_serials ADD CONSTRAINT fk_distribution_order_serials_2 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE distribution_orders ADD CONSTRAINT fk_distribution_orders_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE distribution_orders ADD CONSTRAINT fk_distribution_orders_2 FOREIGN KEY (destination_location_id) REFERENCES locations (id);
ALTER TABLE distribution_orders ADD CONSTRAINT fk_distribution_orders_3 FOREIGN KEY (origin_location_id) REFERENCES locations (id);
ALTER TABLE distribution_received ADD CONSTRAINT fk_distribution_received_1 FOREIGN KEY (dist_order_id) REFERENCES distribution_orders (id);
ALTER TABLE distribution_received ADD CONSTRAINT fk_distribution_received_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE firmware ADD CONSTRAINT fk_firmware_1 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE flow_constraints ADD CONSTRAINT fk_flow_constraints_1 FOREIGN KEY (flow_id) REFERENCES supply_flows (id);
ALTER TABLE flow_constraints ADD CONSTRAINT fk_flow_constraints_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE goods_receipt_messages ADD CONSTRAINT fk_goods_receipt_messages_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE goods_receipt_messages ADD CONSTRAINT fk_goods_receipt_messages_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE goods_receipt_messages ADD CONSTRAINT fk_goods_receipt_messages_3 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE inbound_shipments ADD CONSTRAINT fk_inbound_shipments_1 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE inbound_shipments ADD CONSTRAINT fk_inbound_shipments_2 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id);
ALTER TABLE locations ADD CONSTRAINT fk_locations_1 FOREIGN KEY (country_id) REFERENCES countries (id);
ALTER TABLE locations ADD CONSTRAINT fk_locations_2 FOREIGN KEY (location_type_id) REFERENCES location_types (id);
ALTER TABLE locations ADD CONSTRAINT fk_locations_3 FOREIGN KEY (region_id) REFERENCES regions (id);
ALTER TABLE mass_upload_log ADD CONSTRAINT fk_mass_upload_log_1 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id);
ALTER TABLE network_versions ADD CONSTRAINT fk_network_versions_1 FOREIGN KEY (committed_by_user_id) REFERENCES users (id);
ALTER TABLE non_serialised_inventory ADD CONSTRAINT fk_non_serialised_inventory_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE non_serialised_inventory ADD CONSTRAINT fk_non_serialised_inventory_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE outbound_order_lines ADD CONSTRAINT fk_outbound_order_lines_1 FOREIGN KEY (fulfilling_location_id) REFERENCES locations (id);
ALTER TABLE outbound_order_lines ADD CONSTRAINT fk_outbound_order_lines_2 FOREIGN KEY (order_id) REFERENCES outbound_orders (id);
ALTER TABLE outbound_order_lines ADD CONSTRAINT fk_outbound_order_lines_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE outbound_order_nonserial ADD CONSTRAINT fk_outbound_order_nonserial_1 FOREIGN KEY (order_id) REFERENCES outbound_orders (id);
ALTER TABLE outbound_order_nonserial ADD CONSTRAINT fk_outbound_order_nonserial_2 FOREIGN KEY (order_line_id) REFERENCES outbound_order_lines (id);
ALTER TABLE outbound_order_nonserial ADD CONSTRAINT fk_outbound_order_nonserial_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE outbound_order_serials ADD CONSTRAINT fk_outbound_order_serials_1 FOREIGN KEY (order_id) REFERENCES outbound_orders (id);
ALTER TABLE outbound_order_serials ADD CONSTRAINT fk_outbound_order_serials_2 FOREIGN KEY (order_line_id) REFERENCES outbound_order_lines (id);
ALTER TABLE outbound_order_serials ADD CONSTRAINT fk_outbound_order_serials_3 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_1 FOREIGN KEY (allocation_source_order_id) REFERENCES outbound_orders (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_2 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_3 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_4 FOREIGN KEY (destination_location_id) REFERENCES locations (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_5 FOREIGN KEY (fulfilling_location_id) REFERENCES locations (id);
ALTER TABLE outbound_orders ADD CONSTRAINT fk_outbound_orders_6 FOREIGN KEY (linked_return_order_id) REFERENCES return_orders (id);
ALTER TABLE product_alternatives ADD CONSTRAINT fk_product_alternatives_1 FOREIGN KEY (alternative_product_id) REFERENCES products (id);
ALTER TABLE product_alternatives ADD CONSTRAINT fk_product_alternatives_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_bom_components ADD CONSTRAINT fk_product_bom_components_1 FOREIGN KEY (component_product_id) REFERENCES products (id);
ALTER TABLE product_bom_components ADD CONSTRAINT fk_product_bom_components_2 FOREIGN KEY (parent_product_id) REFERENCES products (id);
ALTER TABLE product_countries ADD CONSTRAINT fk_product_countries_1 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_interchangeable ADD CONSTRAINT fk_product_interchangeable_1 FOREIGN KEY (interchangeable_product_id) REFERENCES products (id);
ALTER TABLE product_interchangeable ADD CONSTRAINT fk_product_interchangeable_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_pricing ADD CONSTRAINT fk_product_pricing_1 FOREIGN KEY (country_id) REFERENCES countries (id);
ALTER TABLE product_pricing ADD CONSTRAINT fk_product_pricing_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_pricing ADD CONSTRAINT fk_product_pricing_3 FOREIGN KEY (region_id) REFERENCES regions (id);
ALTER TABLE product_repair_centres ADD CONSTRAINT fk_product_repair_centres_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE product_repair_centres ADD CONSTRAINT fk_product_repair_centres_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_suppliers ADD CONSTRAINT fk_product_suppliers_1 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE product_suppliers ADD CONSTRAINT fk_product_suppliers_2 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE products ADD CONSTRAINT fk_products_1 FOREIGN KEY (latest_firmware_id) REFERENCES firmware (id);
ALTER TABLE purchase_order_lines ADD CONSTRAINT fk_purchase_order_lines_1 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE purchase_order_lines ADD CONSTRAINT fk_purchase_order_lines_2 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_2 FOREIGN KEY (destination_location_id) REFERENCES locations (id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_3 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE repair_order_documents ADD CONSTRAINT fk_repair_order_documents_1 FOREIGN KEY (repair_order_id) REFERENCES repair_orders (id);
ALTER TABLE repair_order_documents ADD CONSTRAINT fk_repair_order_documents_2 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id);
ALTER TABLE repair_order_serials ADD CONSTRAINT fk_repair_order_serials_1 FOREIGN KEY (repair_order_id) REFERENCES repair_orders (id);
ALTER TABLE repair_order_serials ADD CONSTRAINT fk_repair_order_serials_2 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE repair_orders ADD CONSTRAINT fk_repair_orders_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE repair_orders ADD CONSTRAINT fk_repair_orders_2 FOREIGN KEY (repair_centre_location_id) REFERENCES locations (id);
ALTER TABLE repair_orders ADD CONSTRAINT fk_repair_orders_3 FOREIGN KEY (return_location_id) REFERENCES locations (id);
ALTER TABLE repair_orders ADD CONSTRAINT fk_repair_orders_4 FOREIGN KEY (return_order_id) REFERENCES return_orders (id);
ALTER TABLE repair_rework_orders ADD CONSTRAINT fk_repair_rework_orders_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE repair_rework_orders ADD CONSTRAINT fk_repair_rework_orders_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE repair_rework_orders ADD CONSTRAINT fk_repair_rework_orders_3 FOREIGN KEY (return_location_id) REFERENCES locations (id);
ALTER TABLE repair_rework_received ADD CONSTRAINT fk_repair_rework_received_1 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE repair_rework_received ADD CONSTRAINT fk_repair_rework_received_2 FOREIGN KEY (rr_order_id) REFERENCES repair_rework_orders (id);
ALTER TABLE repair_rework_serials ADD CONSTRAINT fk_repair_rework_serials_1 FOREIGN KEY (rr_order_id) REFERENCES repair_rework_orders (id);
ALTER TABLE repair_rework_serials ADD CONSTRAINT fk_repair_rework_serials_2 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE return_order_serials ADD CONSTRAINT fk_return_order_serials_1 FOREIGN KEY (return_order_id) REFERENCES return_orders (id);
ALTER TABLE return_order_serials ADD CONSTRAINT fk_return_order_serials_2 FOREIGN KEY (serial_id) REFERENCES serial_numbers (id);
ALTER TABLE return_orders ADD CONSTRAINT fk_return_orders_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE return_orders ADD CONSTRAINT fk_return_orders_2 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE return_orders ADD CONSTRAINT fk_return_orders_3 FOREIGN KEY (linked_replacement_order_id) REFERENCES outbound_orders (id);
ALTER TABLE return_orders ADD CONSTRAINT fk_return_orders_4 FOREIGN KEY (linked_rr_order_id) REFERENCES repair_rework_orders (id);
ALTER TABLE return_orders ADD CONSTRAINT fk_return_orders_5 FOREIGN KEY (original_order_id) REFERENCES outbound_orders (id);
ALTER TABLE safety_stock_targets ADD CONSTRAINT fk_safety_stock_targets_1 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE safety_stock_targets ADD CONSTRAINT fk_safety_stock_targets_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE safety_stock_targets ADD CONSTRAINT fk_safety_stock_targets_3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE serial_import_batches ADD CONSTRAINT fk_serial_import_batches_1 FOREIGN KEY (imported_by_user_id) REFERENCES users (id);
ALTER TABLE serial_import_batches ADD CONSTRAINT fk_serial_import_batches_2 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE serial_import_batches ADD CONSTRAINT fk_serial_import_batches_3 FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_1 FOREIGN KEY (current_location_id) REFERENCES locations (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_2 FOREIGN KEY (current_state_id) REFERENCES terminal_states (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_3 FOREIGN KEY (firmware_id) REFERENCES firmware (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_4 FOREIGN KEY (import_batch_id) REFERENCES serial_import_batches (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_5 FOREIGN KEY (pegged_to_order_id) REFERENCES outbound_orders (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_6 FOREIGN KEY (po_id) REFERENCES purchase_orders (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_7 FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_8 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_9 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE state_history ADD CONSTRAINT fk_state_history_1 FOREIGN KEY (actor_user_id) REFERENCES users (id);
ALTER TABLE state_history ADD CONSTRAINT fk_state_history_2 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE state_history ADD CONSTRAINT fk_state_history_3 FOREIGN KEY (serial_number_id) REFERENCES serial_numbers (id);
ALTER TABLE state_history ADD CONSTRAINT fk_state_history_4 FOREIGN KEY (state_id) REFERENCES terminal_states (id);
ALTER TABLE state_transitions ADD CONSTRAINT fk_state_transitions_1 FOREIGN KEY (from_state_id) REFERENCES terminal_states (id);
ALTER TABLE state_transitions ADD CONSTRAINT fk_state_transitions_2 FOREIGN KEY (to_state_id) REFERENCES terminal_states (id);
ALTER TABLE state_valid_location_types ADD CONSTRAINT fk_state_valid_location_types_1 FOREIGN KEY (location_type_id) REFERENCES location_types (id);
ALTER TABLE state_valid_location_types ADD CONSTRAINT fk_state_valid_location_types_2 FOREIGN KEY (state_id) REFERENCES terminal_states (id);
ALTER TABLE supplier_users ADD CONSTRAINT fk_supplier_users_1 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE supplier_users ADD CONSTRAINT fk_supplier_users_2 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE supply_flows ADD CONSTRAINT fk_supply_flows_1 FOREIGN KEY (from_location_id) REFERENCES locations (id);
ALTER TABLE supply_flows ADD CONSTRAINT fk_supply_flows_2 FOREIGN KEY (from_supplier_id) REFERENCES suppliers (id);
ALTER TABLE supply_flows ADD CONSTRAINT fk_supply_flows_3 FOREIGN KEY (network_version_id) REFERENCES network_versions (id);
ALTER TABLE supply_flows ADD CONSTRAINT fk_supply_flows_4 FOREIGN KEY (to_location_id) REFERENCES locations (id);
ALTER TABLE supply_flows ADD CONSTRAINT fk_supply_flows_5 FOREIGN KEY (to_supplier_id) REFERENCES suppliers (id);
ALTER TABLE system_config ADD CONSTRAINT fk_system_config_1 FOREIGN KEY (updated_by_user_id) REFERENCES users (id);
ALTER TABLE transit_time_lanes ADD CONSTRAINT fk_transit_time_lanes_1 FOREIGN KEY (from_location_id) REFERENCES locations (id);
ALTER TABLE transit_time_lanes ADD CONSTRAINT fk_transit_time_lanes_2 FOREIGN KEY (to_location_id) REFERENCES locations (id);
ALTER TABLE user_locations ADD CONSTRAINT fk_user_locations_1 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE user_locations ADD CONSTRAINT fk_user_locations_2 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE user_regions ADD CONSTRAINT fk_user_regions_1 FOREIGN KEY (region_id) REFERENCES regions (id);
ALTER TABLE user_regions ADD CONSTRAINT fk_user_regions_2 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_1 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE users ADD CONSTRAINT fk_users_1 FOREIGN KEY (default_location_id) REFERENCES locations (id);
ALTER TABLE users ADD CONSTRAINT fk_users_2 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE work_order_lines ADD CONSTRAINT fk_work_order_lines_1 FOREIGN KEY (allocated_serial_id) REFERENCES serial_numbers (id);
ALTER TABLE work_order_lines ADD CONSTRAINT fk_work_order_lines_2 FOREIGN KEY (confirmed_serial_id) REFERENCES serial_numbers (id);
ALTER TABLE work_order_lines ADD CONSTRAINT fk_work_order_lines_3 FOREIGN KEY (outbound_order_line_id) REFERENCES outbound_order_lines (id);
ALTER TABLE work_order_lines ADD CONSTRAINT fk_work_order_lines_4 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE work_order_lines ADD CONSTRAINT fk_work_order_lines_5 FOREIGN KEY (work_order_id) REFERENCES work_orders (id);
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_1 FOREIGN KEY (assembly_confirmed_by_user_id) REFERENCES users (id);
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_2 FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_3 FOREIGN KEY (location_id) REFERENCES locations (id);
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_4 FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders (id);
