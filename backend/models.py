from sqlalchemy import Column, Integer, String, Text, Float, TIMESTAMP, ForeignKey, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, nullable=False, unique=True)
    email = Column(Text, unique=True, nullable=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String, nullable=False)
    default_location_id = Column(Integer, nullable=True)
    active = Column(Integer, nullable=False, default=1)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


# ---------------------------------------------------------------------------
# Master Data models
# ---------------------------------------------------------------------------

class LocationType(Base):
    __tablename__ = "location_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    gr_applicable = Column(Integer, nullable=False, default=1)
    accruals_applicable = Column(Text, nullable=False, default="NA")  # NA|WEEKLY|MONTHLY|QUARTERLY
    active = Column(Integer, nullable=False, default=1)


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    location_type_id = Column(Integer, ForeignKey("location_types.id"), nullable=False)
    country = Column(Text, nullable=False)
    city = Column(Text)
    reporting_currency = Column(Text, nullable=False, default="EUR")
    active = Column(Integer, nullable=False, default=1)
    country_code = Column(Text, ForeignKey("countries.country_code"), nullable=True)
    location_type = relationship("LocationType")


class BusinessCalendar(Base):
    __tablename__ = "business_calendars"
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(Text, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    timezone = Column(Text, nullable=False, default="UTC")
    working_days = Column(Text, nullable=False, default="Mon,Tue,Wed,Thu,Fri")
    work_hours_start = Column(Text, nullable=False, default="08:00")
    work_hours_end = Column(Text, nullable=False, default="17:00")
    location = relationship("Location")
    supplier = relationship("Supplier")
    holidays = relationship("BusinessCalendarHoliday", back_populates="calendar", cascade="all, delete-orphan")


class BusinessCalendarHoliday(Base):
    __tablename__ = "business_calendar_holidays"
    id = Column(Integer, primary_key=True, autoincrement=True)
    calendar_id = Column(Integer, ForeignKey("business_calendars.id"), nullable=False)
    holiday_date = Column(Text, nullable=False)
    description = Column(Text)
    calendar = relationship("BusinessCalendar", back_populates="holidays")


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    country = Column(Text, nullable=False)
    city = Column(Text)
    contact_email = Column(Text)
    contact_phone = Column(Text)
    active = Column(Integer, nullable=False, default=1)
    country_code = Column(Text, ForeignKey("countries.country_code"), nullable=True)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_ref = Column(Text, nullable=False, unique=True)
    duns_number = Column(Text)
    name = Column(Text, nullable=False)
    customer_type = Column(Text, nullable=False)
    country = Column(Text, nullable=False)
    state_region = Column(Text)
    credit_rating = Column(Text)
    delivery_address = Column(Text)
    contact_email = Column(Text)
    contact_phone = Column(Text)
    active = Column(Integer, nullable=False, default=1)
    segment_id = Column(Integer, ForeignKey("customer_segments.id"), nullable=True)
    segment = relationship("CustomerSegment")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    product_type = Column(Text, nullable=False)
    product_category = Column(Text, nullable=False)
    serialised = Column(Integer, nullable=False, default=0)
    vendor_keyloaded = Column(Integer, nullable=False, default=0)
    is_bom = Column(Integer, nullable=False, default=0)
    unit_value = Column(Float)
    unit_currency = Column(Text, default="EUR")
    unit_value_symbol = Column(Text)
    unit_value_decimals = Column(Integer, default=2)
    unit_value_display = Column(Text)
    refurb_unit_value = Column(Float)
    refurb_unit_currency = Column(Text)
    hs_code = Column(Text)
    active = Column(Integer, nullable=False, default=1)
    updated_at = Column(TIMESTAMP)
    # Phase 2K — Alerting
    battery_life_days = Column(Integer, nullable=True)   # expected days between recharges
    warranty_days = Column(Integer, nullable=True)       # warranty period in days from first sale
    repair_max_days = Column(Integer, nullable=True)     # max acceptable days in repair
    # Product image
    image_data = Column(LargeBinary, nullable=True)
    image_content_type = Column(Text, nullable=True)
    # Phase 3B — Firmware
    latest_firmware_id = Column(Integer, ForeignKey("firmware.id"), nullable=True)


class StateValidLocationType(Base):
    __tablename__ = "state_valid_location_types"
    state_id = Column(Integer, ForeignKey("terminal_states.id"), primary_key=True)
    location_type_id = Column(Integer, ForeignKey("location_types.id"), primary_key=True)
    location_type = relationship("LocationType")


class TerminalState(Base):
    __tablename__ = "terminal_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(Text, nullable=False, unique=True)
    display_name = Column(Text, nullable=False)
    warehouse_type = Column(Text)
    description = Column(Text)
    active = Column(Integer, nullable=False, default=1)
    sequence_number = Column(Integer)
    expected_duration_value = Column(Float)
    expected_duration_unit = Column(Text)


class SerialNumber(Base):
    __tablename__ = "serial_numbers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    serial_number = Column(Text, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    current_state_id = Column(Integer, ForeignKey("terminal_states.id"))
    current_location_id = Column(Integer, ForeignKey("locations.id"))
    stock_type = Column(Text, nullable=False, default="Live")
    security_seal = Column(Integer, default=0)
    key_loaded = Column(Integer, default=0)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"))
    po_line_id = Column(Integer, ForeignKey("purchase_order_lines.id"))
    active = Column(Integer, nullable=False, default=1)
    accumulated_cost = Column(Float, default=0)
    lot_number = Column(Text)
    terminal_type = Column(Text)
    wifi_mac = Column(Text)
    bluetooth_mac = Column(Text)
    ethernet_mac = Column(Text)
    imei1 = Column(Text)
    imei2 = Column(Text)
    iccid = Column(Text)
    eid = Column(Text)
    key_id = Column(Text)
    firmware_id = Column(Integer, ForeignKey("firmware.id"), nullable=True)
    firmware_applied_at = Column(TIMESTAMP, nullable=True)
    pegged_to_order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=True)
    import_batch_id = Column(Integer, ForeignKey("serial_import_batches.id"), nullable=True)
    shipment_reference = Column(Text, nullable=True)
    carrier = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    current_state = relationship("TerminalState")
    current_location = relationship("Location")
    supplier = relationship("Supplier")
    product = relationship("Product")
    firmware = relationship("Firmware", foreign_keys=[firmware_id])


class NonSerialisedInventory(Base):
    __tablename__ = "non_serialised_inventory"
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    state = Column(Text, nullable=False, default="Available")
    quantity = Column(Integer, nullable=False, default=0)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    product = relationship("Product")
    location = relationship("Location")


class StateHistory(Base):
    __tablename__ = "state_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    state_id = Column(Integer, ForeignKey("terminal_states.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"))
    datetime_utc = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    timezone = Column(Text, nullable=False, default="UTC")
    actor_type = Column(Text, nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"))
    notes = Column(Text)
    activity_description = Column(Text)
    order_reference = Column(Text)
    activity_cost = Column(Float)
    activity_cost_currency = Column(Text)
    reporting_currency_equiv = Column(Float)
    exchange_rate_applied = Column(Float)
    serial = relationship("SerialNumber")
    state = relationship("TerminalState")
    location = relationship("Location")
    actor_user = relationship("User")


class OrderNumbering(Base):
    __tablename__ = "order_numbering"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_type = Column(Text, nullable=False, unique=True)
    prefix = Column(Text, nullable=False)
    padding_length = Column(Integer, nullable=False, default=6)
    current_sequence = Column(Integer, nullable=False, default=0)


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

class InboundShipment(Base):
    __tablename__ = "inbound_shipments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    shipment_reference = Column(Text)
    carrier = Column(Text)
    carrier_tracking_ref = Column(Text)
    estimated_arrival_date = Column(Text)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    po_number = Column(Text, nullable=False, unique=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    order_date = Column(Text, nullable=False)
    expected_arrival_date = Column(Text)
    status = Column(Text, nullable=False, default="Draft")
    notes = Column(Text)
    received_date = Column(Text)
    external_reference = Column(Text)
    partial_order = Column(Text)
    environment = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    supplier = relationship("Supplier")
    destination_location = relationship("Location")
    created_by = relationship("User")
    lines = relationship("PurchaseOrderLine", back_populates="po", cascade="all, delete-orphan")


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    line_number = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty_ordered = Column(Integer, nullable=False)
    qty_expected = Column(Integer, nullable=False, default=0)
    qty_received = Column(Integer, nullable=False, default=0)
    received_date = Column(Text)
    price_per_product = Column(Float, nullable=True)
    price_currency = Column(Text, nullable=True)
    po = relationship("PurchaseOrder", back_populates="lines")
    product = relationship("Product")


# ---------------------------------------------------------------------------
# Outbound Orders (Sales / Rental / Replacement / Distribution)
# ---------------------------------------------------------------------------

class OutboundOrder(Base):
    __tablename__ = "outbound_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    order_type = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="Draft")
    customer_id = Column(Integer, ForeignKey("customers.id"))
    destination_location_id = Column(Integer, ForeignKey("locations.id"))
    atp_ship_date = Column(Text)
    atp_delivery_date = Column(Text)
    atp_feasible = Column(Integer, default=1)
    fulfilling_location_id = Column(Integer, ForeignKey("locations.id"))
    carrier = Column(Text)
    tracking_number = Column(Text)
    shipped_date = Column(Text)
    estimated_arrival_date = Column(Text)
    shipping_cost = Column(Float)
    shipping_cost_currency = Column(Text)
    rental_period_months = Column(Integer)
    rental_fee = Column(Float)
    rental_fee_currency = Column(Text)
    rental_expected_return_date = Column(Text)
    linked_return_order_id = Column(Integer, ForeignKey("return_orders.id"))
    order_state = Column(Text)
    merchant_reference = Column(Text)
    stock = Column(Text)
    location_code = Column(Text)
    company_account = Column(Text)
    environment = Column(Text)
    inv_from_company = Column(Text)
    inv_from_vat_number = Column(Text)
    inv_from_reg_number = Column(Text)
    inv_from_phone = Column(Text)
    inv_from_addr_line1 = Column(Text)
    inv_from_addr_line2 = Column(Text)
    inv_from_addr_city = Column(Text)
    inv_from_addr_postal = Column(Text)
    inv_from_addr_state = Column(Text)
    inv_from_addr_country = Column(Text)
    inv_to_company = Column(Text)
    inv_to_attention = Column(Text)
    inv_to_vat_number = Column(Text)
    inv_to_phone = Column(Text)
    inv_to_addr_line1 = Column(Text)
    inv_to_addr_line2 = Column(Text)
    inv_to_addr_city = Column(Text)
    inv_to_addr_postal = Column(Text)
    inv_to_addr_state = Column(Text)
    inv_to_addr_country = Column(Text)
    tracking_type = Column(Text)
    shipment_vat_number = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    allocation_source_order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    customer = relationship("Customer")
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    fulfilling_location = relationship("Location", foreign_keys=[fulfilling_location_id])
    created_by = relationship("User")
    lines = relationship("OutboundOrderLine", back_populates="order", cascade="all, delete-orphan")
    serials = relationship("OutboundOrderSerial", back_populates="order", cascade="all, delete-orphan")


class OutboundOrderLine(Base):
    __tablename__ = "outbound_order_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=False)
    line_number = Column(Integer, nullable=False)
    line_id = Column(Text)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    group_id = Column(Text)
    fulfilling_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    edd = Column(Text, nullable=True)
    atp_status = Column(Text, nullable=True)
    component_transfer_orders = Column(Text, nullable=True)
    bom_assembly_status = Column(Text, nullable=True)
    atp_reasoning = Column(Text, nullable=True)
    atp_split_details = Column(Text, nullable=True)
    order = relationship("OutboundOrder", back_populates="lines")
    product = relationship("Product")
    fulfilling_location = relationship("Location")


class OutboundOrderSerial(Base):
    __tablename__ = "outbound_order_serials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=False)
    order_line_id = Column(Integer, ForeignKey("outbound_order_lines.id"), nullable=False)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    shipped_line_id = Column(Text)
    security_seal = Column(Text)
    iccid = Column(Text)
    order = relationship("OutboundOrder", back_populates="serials")
    serial = relationship("SerialNumber")


class OutboundOrderNonSerial(Base):
    __tablename__ = "outbound_order_nonserial"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=False)
    order_line_id = Column(Integer, ForeignKey("outbound_order_lines.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)


# ---------------------------------------------------------------------------
# Distribution Orders (DS)
# ---------------------------------------------------------------------------

class DistributionOrder(Base):
    __tablename__ = "distribution_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    distribution_reference = Column(Text)
    environment = Column(Text, default="Live")
    inbound_state = Column(Text)
    origin_location_id = Column(Integer, ForeignKey("locations.id"))
    destination_location_id = Column(Integer, ForeignKey("locations.id"))
    status = Column(Text, nullable=False, default="Draft")
    shipped_at = Column(TIMESTAMP)
    delivered_at = Column(TIMESTAMP)
    ship_from_company = Column(Text)
    ship_from_first_name = Column(Text)
    ship_from_last_name = Column(Text)
    ship_from_phone = Column(Text)
    ship_from_email = Column(Text)
    ship_from_addr_line1 = Column(Text)
    ship_from_addr_line2 = Column(Text)
    ship_from_addr_city = Column(Text)
    ship_from_addr_postal = Column(Text)
    ship_from_addr_state = Column(Text)
    ship_from_addr_country = Column(Text)
    ship_to_company = Column(Text)
    ship_to_first_name = Column(Text)
    ship_to_last_name = Column(Text)
    ship_to_phone = Column(Text)
    ship_to_email = Column(Text)
    ship_to_addr_line1 = Column(Text)
    ship_to_addr_line2 = Column(Text)
    ship_to_addr_city = Column(Text)
    ship_to_addr_postal = Column(Text)
    ship_to_addr_state = Column(Text)
    ship_to_addr_country = Column(Text)
    tracking_type = Column(Text)
    tracking_carrier = Column(Text)
    tracking_number = Column(Text)
    inbound_key = Column(Text)
    inbounded_at = Column(TIMESTAMP)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    origin_location = relationship("Location", foreign_keys=[origin_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    lines = relationship("DistributionOrderLine", back_populates="order", cascade="all, delete-orphan")
    serials = relationship("DistributionOrderSerial", back_populates="order", cascade="all, delete-orphan")


class DistributionOrderLine(Base):
    __tablename__ = "distribution_order_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    dist_order_id = Column(Integer, ForeignKey("distribution_orders.id"), nullable=False)
    line_id = Column(Text)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    stock = Column(Text)
    product_state = Column(Text)
    order = relationship("DistributionOrder", back_populates="lines")
    product = relationship("Product")


class DistributionOrderSerial(Base):
    __tablename__ = "distribution_order_serials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    dist_order_id = Column(Integer, ForeignKey("distribution_orders.id"), nullable=False)
    shipped_line_id = Column(Text)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"))
    security_seal = Column(Text)
    order = relationship("DistributionOrder", back_populates="serials")
    serial = relationship("SerialNumber")


# ---------------------------------------------------------------------------
# Repair / Rework Orders (RR)
# ---------------------------------------------------------------------------

class RepairReworkOrder(Base):
    __tablename__ = "repair_rework_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    location_id = Column(Integer, ForeignKey("locations.id"))
    external_reference = Column(Text)
    dispatch_type = Column(Text, nullable=False, default="Repair")
    reason = Column(Text)
    environment = Column(Text, default="Live")
    status = Column(Text, nullable=False, default="Draft")
    outbound_shipped_at = Column(TIMESTAMP)
    ship_to_first_name = Column(Text)
    ship_to_last_name = Column(Text)
    ship_to_company = Column(Text)
    ship_to_phone = Column(Text)
    ship_to_email = Column(Text)
    ship_to_addr_line1 = Column(Text)
    ship_to_addr_city = Column(Text)
    ship_to_addr_postal = Column(Text)
    ship_to_addr_state = Column(Text)
    ship_to_addr_country = Column(Text)
    tracking_type = Column(Text)
    tracking_carrier = Column(Text)
    tracking_number = Column(Text)
    inbound_shipped_at = Column(TIMESTAMP)
    inbound_key = Column(Text)
    inbounded_at = Column(TIMESTAMP)
    estimated_return_date = Column(Text)
    actual_return_date = Column(Text)
    return_location_id = Column(Integer, ForeignKey("locations.id"))
    outcome = Column(Text)
    actual_cost = Column(Float)
    actual_cost_currency = Column(Text)
    repair_notes = Column(Text)
    rma_reference = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    location = relationship("Location", foreign_keys=[location_id])
    return_location = relationship("Location", foreign_keys=[return_location_id])
    serials = relationship("RepairReworkSerial", back_populates="rr_order", cascade="all, delete-orphan")


class RepairReworkSerial(Base):
    __tablename__ = "repair_rework_serials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rr_order_id = Column(Integer, ForeignKey("repair_rework_orders.id"), nullable=False)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"))
    product_code = Column(Text)
    rr_order = relationship("RepairReworkOrder", back_populates="serials")
    serial = relationship("SerialNumber")


class RepairReworkReceived(Base):
    __tablename__ = "repair_rework_received"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rr_order_id = Column(Integer, ForeignKey("repair_rework_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    product_state = Column(Text)
    serials = Column(Text)


# ---------------------------------------------------------------------------
# Repair Orders (RP — from Returns module)
# ---------------------------------------------------------------------------

class RepairOrder(Base):
    __tablename__ = "repair_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    return_order_id = Column(Integer, ForeignKey("return_orders.id"))
    repair_centre_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    dispatch_date = Column(Text)
    estimated_return_date = Column(Text)
    actual_return_date = Column(Text)
    return_location_id = Column(Integer, ForeignKey("locations.id"))
    status = Column(Text, nullable=False, default="Dispatched")
    outcome = Column(Text)
    actual_cost = Column(Float)
    actual_cost_currency = Column(Text)
    repair_notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    repair_centre = relationship("Location", foreign_keys=[repair_centre_location_id])
    return_location = relationship("Location", foreign_keys=[return_location_id])
    serials = relationship("RepairOrderSerial", back_populates="repair_order", cascade="all, delete-orphan")


class RepairOrderSerial(Base):
    __tablename__ = "repair_order_serials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    repair_order = relationship("RepairOrder", back_populates="serials")
    serial = relationship("SerialNumber")


# ---------------------------------------------------------------------------
# Return Orders
# ---------------------------------------------------------------------------

class ReturnOrder(Base):
    __tablename__ = "return_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    original_order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="Initiated")
    inspection_outcome = Column(Text, nullable=True)
    linked_replacement_order_id = Column(Integer, nullable=True)
    linked_rr_order_id = Column(Integer, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    customer = relationship("Customer")
    original_order = relationship("OutboundOrder", foreign_keys=[original_order_id])
    rma_reference = Column(Text, nullable=True)
    serials = relationship("ReturnOrderSerial", back_populates="return_order", cascade="all, delete-orphan")


class ReturnOrderSerial(Base):
    __tablename__ = "return_order_serials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_order_id = Column(Integer, ForeignKey("return_orders.id"), nullable=False)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=False)
    return_order = relationship("ReturnOrder", back_populates="serials")
    serial = relationship("SerialNumber")


# ---------------------------------------------------------------------------
# Cost Engine master data (Phase 2D)
# ---------------------------------------------------------------------------

class ActivityCostMaster(Base):
    __tablename__ = "activity_cost_master"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_code = Column(Text, nullable=False)
    state_code = Column(Text, nullable=False)
    product_code = Column(Text, nullable=True)   # NULL = generic (any product)
    amount = Column(Float, nullable=False)
    currency = Column(Text, nullable=False, default="EUR")
    active = Column(Integer, nullable=False, default=1)


class ExchangeRateMaster(Base):
    __tablename__ = "exchange_rate_master"
    id = Column(Integer, primary_key=True, autoincrement=True)
    from_currency = Column(Text, nullable=False)
    to_currency = Column(Text, nullable=False)
    rate = Column(Float, nullable=False)
    effective_date = Column(Text, nullable=False)  # YYYY-MM-DD


# ---------------------------------------------------------------------------
# Work Orders (Phase 2F)
# ---------------------------------------------------------------------------

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Text, nullable=False, unique=True)
    outbound_order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=True)
    wo_type = Column(Text, nullable=False, default="Pick")
    status = Column(Text, nullable=False, default="Open")
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    # relationships
    outbound_order = relationship("OutboundOrder")
    location = relationship("Location")
    created_by = relationship("User")
    lines = relationship("WorkOrderLine", back_populates="work_order", cascade="all, delete-orphan")


class WorkOrderLine(Base):
    __tablename__ = "work_order_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    outbound_order_line_id = Column(Integer, ForeignKey("outbound_order_lines.id"), nullable=True)
    allocated_serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    confirmed_serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    is_short_pick = Column(Integer, nullable=False, default=0)
    is_over_pick = Column(Integer, nullable=False, default=0)
    # relationships
    work_order = relationship("WorkOrder", back_populates="lines")
    outbound_order_line = relationship("OutboundOrderLine")
    allocated_serial = relationship("SerialNumber", foreign_keys=[allocated_serial_id])
    confirmed_serial = relationship("SerialNumber", foreign_keys=[confirmed_serial_id])


# ---------------------------------------------------------------------------
# Phase 2G — Claims Management
# ---------------------------------------------------------------------------

class ClaimType(Base):
    __tablename__ = "claim_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    raised_against = Column(Text, nullable=False, default="Supplier")  # Supplier | Carrier | Both
    active = Column(Integer, nullable=False, default=1)


class Claim(Base):
    __tablename__ = "claims"
    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_number = Column(Text, nullable=False, unique=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    outbound_order_id = Column(Integer, ForeignKey("outbound_orders.id"), nullable=True)
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    claim_type_id = Column(Integer, ForeignKey("claim_types.id"), nullable=False)
    raised_against = Column(Text, nullable=False)  # Supplier | Carrier
    status = Column(Text, nullable=False, default="Open")  # Open | Under Review | Resolved | Rejected
    urgency = Column(Text, nullable=False, default="Normal")  # Urgent | Important | Normal
    description = Column(Text)
    resolution_notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    claim_type = relationship("ClaimType")
    po = relationship("PurchaseOrder")
    outbound_order = relationship("OutboundOrder", foreign_keys=[outbound_order_id], lazy="joined")
    serial = relationship("SerialNumber")
    created_by = relationship("User")


class ClaimAttachment(Base):
    __tablename__ = "claim_attachments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    filename = Column(Text, nullable=False)
    content_type = Column(Text)
    data = Column(LargeBinary, nullable=False)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(TIMESTAMP, server_default=func.current_timestamp())


# ---------------------------------------------------------------------------
# Product — Supplier association (many-to-many with lead time)
# ---------------------------------------------------------------------------

class ProductSupplier(Base):
    __tablename__ = "product_suppliers"
    product_id = Column(Integer, ForeignKey("products.id"), primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), primary_key=True)
    lead_time_days = Column(Integer, nullable=True)
    product = relationship("Product")
    supplier = relationship("Supplier")


# ---------------------------------------------------------------------------
# Transit Time Lanes
# ---------------------------------------------------------------------------

class TransitTimeLane(Base):
    __tablename__ = "transit_time_lanes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    from_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    to_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    transport_mode = Column(Text, nullable=False)
    lead_time_days = Column(Integer, nullable=False)
    from_location = relationship("Location", foreign_keys=[from_location_id])
    to_location = relationship("Location", foreign_keys=[to_location_id])


class TransitTimeFallback(Base):
    __tablename__ = "transit_time_fallback"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_time_days = Column(Integer, nullable=False, default=14)


# ---------------------------------------------------------------------------
# Phase 2I — Supply Planning + Repositioning
# ---------------------------------------------------------------------------

class SafetyStockTarget(Base):
    __tablename__ = "safety_stock_targets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    min_qty = Column(Integer, nullable=False, default=0)
    reorder_point = Column(Integer, nullable=False, default=0)
    reorder_qty = Column(Integer, nullable=False, default=0)
    notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    product = relationship("Product")
    location = relationship("Location")
    created_by = relationship("User")


# ---------------------------------------------------------------------------
# Phase 2H — Demand Planning
# ---------------------------------------------------------------------------

class DemandSignal(Base):
    __tablename__ = "demand_signals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    period_date = Column(Text, nullable=False)   # YYYY-MM-DD, first of month
    quantity = Column(Integer, nullable=False, default=0)
    notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    product = relationship("Product")
    location = relationship("Location")
    created_by = relationship("User")


# ---------------------------------------------------------------------------
# Phase 2K — Alerting Framework
# ---------------------------------------------------------------------------

class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_code = Column(Text, nullable=False, unique=True)  # RETURN_RECEIVED, REPAIR_OVERDUE, etc.
    name = Column(Text, nullable=False)
    description = Column(Text)
    enabled = Column(Integer, nullable=False, default=1)
    threshold_urgent_days = Column(Integer, nullable=True)
    threshold_critical_days = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False)
    severity = Column(Text, nullable=False, default="Normal")
    status = Column(Text, nullable=False, default="New")
    serial_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(Text, nullable=True)
    message = Column(Text, nullable=False)
    days_overdue = Column(Integer, nullable=True)
    acknowledged_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    rule = relationship("AlertRule")
    serial = relationship("SerialNumber")
    product = relationship("Product")
    location = relationship("Location")
    acknowledged_by = relationship("User")


# ---------------------------------------------------------------------------
# Phase 3A — RBAC: multi-role, location scoping, region scoping
# ---------------------------------------------------------------------------

class UserRole(Base):
    __tablename__ = "user_roles"
    user_id    = Column(Integer, ForeignKey("users.id"), primary_key=True)
    role_code  = Column(Text, nullable=False, primary_key=True)
    assigned_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    user = relationship("User")


class UserLocation(Base):
    __tablename__ = "user_locations"
    user_id     = Column(Integer, ForeignKey("users.id"), primary_key=True)
    location_id = Column(Integer, ForeignKey("locations.id"), primary_key=True)
    user     = relationship("User")
    location = relationship("Location")


class UserRegion(Base):
    __tablename__ = "user_regions"
    user_id   = Column(Integer, ForeignKey("users.id"), primary_key=True)
    region_id = Column(Integer, ForeignKey("regions.id"), primary_key=True)
    user   = relationship("User")
    region = relationship("Region")


# ---------------------------------------------------------------------------
# Phase 3A — System Config
# ---------------------------------------------------------------------------

class SystemConfig(Base):
    __tablename__ = "system_config"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    config_key          = Column(Text, nullable=False, unique=True)
    label               = Column(Text, nullable=False)
    description         = Column(Text)
    data_type           = Column(Text, nullable=False)   # string|integer|boolean|decimal
    current_value       = Column(Text)
    default_value       = Column(Text)
    updated_at          = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_by_user_id  = Column(Integer, ForeignKey("users.id"))
    updated_by          = relationship("User")


# ---------------------------------------------------------------------------
# Phase 3B — Regions & Countries
# ---------------------------------------------------------------------------

class Region(Base):
    __tablename__ = "regions"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    region_code = Column(Text, nullable=False, unique=True)
    region_name = Column(Text, nullable=False)
    active      = Column(Integer, nullable=False, default=1)


class Country(Base):
    __tablename__ = "countries"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    country_code = Column(Text, nullable=False, unique=True)
    country_name = Column(Text, nullable=False)
    region_id    = Column(Integer, ForeignKey("regions.id"), nullable=False)
    serviced     = Column(Integer, nullable=False, default=0)
    activated_at = Column(TIMESTAMP)
    currency     = Column(Text, nullable=True)
    region = relationship("Region")


# ---------------------------------------------------------------------------
# Phase 3B — Network Design
# ---------------------------------------------------------------------------

class NetworkVersion(Base):
    __tablename__ = "network_versions"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    version_name         = Column(Text, nullable=False)
    version_type         = Column(Text, nullable=False)   # baseline | simulation
    reference_number     = Column(Text)
    effective_date       = Column(Text)
    committed_at         = Column(TIMESTAMP)
    committed_by_user_id = Column(Integer, ForeignKey("users.id"))
    notes                = Column(Text)
    is_current           = Column(Integer, nullable=False, default=0)
    created_at           = Column(TIMESTAMP, server_default=func.current_timestamp())
    committed_by = relationship("User")
    flows        = relationship("SupplyFlow", back_populates="version", cascade="all, delete-orphan")


class SupplyFlow(Base):
    __tablename__ = "supply_flows"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    network_version_id = Column(Integer, ForeignKey("network_versions.id"), nullable=False)
    from_location_id   = Column(Integer, ForeignKey("locations.id"), nullable=True)
    from_supplier_id   = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    to_location_id     = Column(Integer, ForeignKey("locations.id"), nullable=True)
    to_supplier_id     = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    flow_type          = Column(Text, nullable=False)
    lead_time          = Column(Float, nullable=True)
    lead_time_unit     = Column(Text, nullable=False, default="days")  # days|hours
    active             = Column(Integer, nullable=False, default=1)
    version       = relationship("NetworkVersion", back_populates="flows")
    from_location = relationship("Location", foreign_keys=[from_location_id])
    from_supplier = relationship("Supplier", foreign_keys=[from_supplier_id])
    to_location   = relationship("Location", foreign_keys=[to_location_id])
    to_supplier   = relationship("Supplier", foreign_keys=[to_supplier_id])
    constraints   = relationship("FlowConstraint", back_populates="flow", cascade="all, delete-orphan")


class FlowConstraint(Base):
    __tablename__ = "flow_constraints"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    flow_id            = Column(Integer, ForeignKey("supply_flows.id"), nullable=False)
    product_id         = Column(Integer, ForeignKey("products.id"))
    replenishment_type = Column(Text)
    valid_from         = Column(Text)
    valid_to           = Column(Text)
    flow    = relationship("SupplyFlow", back_populates="constraints")
    product = relationship("Product")


# ---------------------------------------------------------------------------
# Phase 3B — Firmware
# ---------------------------------------------------------------------------

class Firmware(Base):
    __tablename__ = "firmware"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    firmware_name  = Column(Text, nullable=False)
    version        = Column(Text, nullable=False)
    release_number = Column(Text)
    release_date   = Column(Text)
    release_hour   = Column(Text)
    key_used       = Column(Text)
    file_path      = Column(Text)
    product_id     = Column(Integer, ForeignKey("products.id"), nullable=True)
    active         = Column(Integer, nullable=False, default=1)
    created_at     = Column(TIMESTAMP, server_default=func.current_timestamp())
    product        = relationship("Product", foreign_keys=[product_id])


# ---------------------------------------------------------------------------
# Phase 3B — Product Pricing & Alternatives
# ---------------------------------------------------------------------------

class ProductPricing(Base):
    __tablename__ = "product_pricing"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    product_id         = Column(Integer, ForeignKey("products.id"), nullable=False)
    region_id          = Column(Integer, ForeignKey("regions.id"))
    country_id         = Column(Integer, ForeignKey("countries.id"))
    sell_price         = Column(Float)
    rental_price_month = Column(Float)
    currency           = Column(Text, nullable=False)
    effective_date     = Column(Text)
    product = relationship("Product")
    region  = relationship("Region")
    country = relationship("Country")


class ProductAlternative(Base):
    __tablename__ = "product_alternatives"
    id                     = Column(Integer, primary_key=True, autoincrement=True)
    product_id             = Column(Integer, ForeignKey("products.id"), nullable=False)
    alternative_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    sequence               = Column(Integer, nullable=False, default=1)
    product     = relationship("Product", foreign_keys=[product_id])
    alternative = relationship("Product", foreign_keys=[alternative_product_id])


# ---------------------------------------------------------------------------
# Phase 3C — ATP Rules & Customer Segments
# ---------------------------------------------------------------------------

class CustomerSegment(Base):
    __tablename__ = "customer_segments"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    segment_code = Column(Text, nullable=False, unique=True)
    segment_name = Column(Text, nullable=False)
    priority     = Column(Integer, nullable=False, default=99)


class ATPRule(Base):
    __tablename__ = "atp_rules"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    region_id   = Column(Integer, ForeignKey("regions.id"))
    segment_id  = Column(Integer, ForeignKey("customer_segments.id"))
    rule_key    = Column(Text, nullable=False)
    rule_value  = Column(Text, nullable=False)
    description = Column(Text)
    region  = relationship("Region")
    segment = relationship("CustomerSegment")


# ---------------------------------------------------------------------------
# Phase 3E — Serial Import Batches & Repair Documents
# ---------------------------------------------------------------------------

class SerialImportBatch(Base):
    __tablename__ = "serial_import_batches"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    po_id               = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    po_line_id          = Column(Integer, ForeignKey("purchase_order_lines.id"), nullable=False)
    shipment_reference  = Column(Text, nullable=False)
    source_type         = Column(Text, nullable=False)   # manual | ai_document | excel
    document_file_path  = Column(Text)
    status              = Column(Text, nullable=False, default="Pending")
    confirmed_at        = Column(TIMESTAMP)
    imported_by_user_id = Column(Integer, ForeignKey("users.id"))
    imported_at         = Column(TIMESTAMP, server_default=func.current_timestamp())
    po          = relationship("PurchaseOrder")
    imported_by = relationship("User")


class RepairDocument(Base):
    __tablename__ = "repair_documents"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    rr_order_id         = Column(Integer, ForeignKey("repair_rework_orders.id"), nullable=False)
    file_name           = Column(Text, nullable=False)
    file_path           = Column(Text, nullable=False)
    file_size_bytes     = Column(Integer)
    uploaded_at         = Column(TIMESTAMP, server_default=func.current_timestamp())
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"))
    rr_order    = relationship("RepairReworkOrder")
    uploaded_by = relationship("User")


# ---------------------------------------------------------------------------
# Phase 3F — AI Conversations & Messages
# ---------------------------------------------------------------------------

class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id   = Column(Text, nullable=False, unique=True)
    page_context = Column(Text)
    started_at   = Column(TIMESTAMP, server_default=func.current_timestamp())
    ended_at     = Column(TIMESTAMP)
    user     = relationship("User")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")


class AIMessage(Base):
    __tablename__ = "ai_messages"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id"), nullable=False)
    role            = Column(Text, nullable=False)   # user | assistant
    content         = Column(Text, nullable=False)
    created_at      = Column(TIMESTAMP, server_default=func.current_timestamp())
    conversation = relationship("AIConversation", back_populates="messages")


# ---------------------------------------------------------------------------
# Phase 3B — Product BOM Components & Country Applicability
# ---------------------------------------------------------------------------

class ProductBomComponent(Base):
    __tablename__ = "product_bom_components"
    id                      = Column(Integer, primary_key=True, autoincrement=True)
    parent_product_id       = Column(Integer, ForeignKey("products.id"), nullable=False)
    component_product_id    = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity                = Column(Integer, nullable=False, default=1)
    assembly_leadtime_value = Column(Integer, nullable=True)
    assembly_leadtime_unit  = Column(Text, nullable=True)   # hours | days
    parent    = relationship("Product", foreign_keys=[parent_product_id])
    component = relationship("Product", foreign_keys=[component_product_id])


class GoodsReceiptMessage(Base):
    __tablename__ = "goods_receipt_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    message_type = Column(Text, nullable=False)  # GOODS_RECEIPT or REVERSE_GOODS_RECEIPT
    serial_count = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    created_by_user_id = Column(Integer, ForeignKey("users.id"))


class ProductCountry(Base):
    __tablename__ = "product_countries"
    product_code = Column(Text, primary_key=True)
    country_code = Column(Text, primary_key=True)
    active       = Column(Integer, nullable=False, default=1)


# ---------------------------------------------------------------------------
# Agent infrastructure (Phase 3F)
# ---------------------------------------------------------------------------

class AgentRun(Base):
    __tablename__ = "agent_runs"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    run_id           = Column(Text, nullable=False, unique=True)
    agent_name       = Column(Text, nullable=False)
    triggered_by     = Column(Text)
    status           = Column(Text, nullable=False, default="running")
    shortages_found  = Column(Integer, default=0)
    actions_taken    = Column(Integer, default=0)
    hitl_items       = Column(Integer, default=0)
    intents_recorded = Column(Integer, default=0)
    intents_executed = Column(Integer, default=0)
    summary_text     = Column(Text)
    started_at       = Column(TIMESTAMP, server_default=func.current_timestamp())
    completed_at     = Column(TIMESTAMP)


class AgentAllocationIntent(Base):
    __tablename__ = "agent_allocation_intents"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    run_id               = Column(Text, nullable=False)
    agent_name           = Column(Text, nullable=False)
    product_id           = Column(Integer, ForeignKey("products.id"))
    from_location_id     = Column(Integer, ForeignKey("locations.id"))
    to_location_id       = Column(Integer, ForeignKey("locations.id"))
    reserved_qty         = Column(Integer, nullable=False, default=0)
    remaining_qty        = Column(Integer, nullable=False, default=0)
    reasoning            = Column(Text)
    status               = Column(Text, nullable=False, default="Pending")
    horizon_days         = Column(Integer, default=14)
    created_at           = Column(TIMESTAMP, server_default=func.current_timestamp())
    executed_at          = Column(TIMESTAMP)
    cancelled_at         = Column(TIMESTAMP)
    cancelled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    execution_do_refs    = Column(Text)
    product              = relationship("Product")
    from_location        = relationship("Location", foreign_keys=[from_location_id])
    to_location          = relationship("Location", foreign_keys=[to_location_id])
    cancelled_by         = relationship("User", foreign_keys=[cancelled_by_user_id])


class AgentLog(Base):
    __tablename__ = "agent_logs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    run_id     = Column(Text, nullable=False)
    agent_name = Column(Text, nullable=False)
    step_type  = Column(Text, nullable=False)   # THINK / ACT / OBSERVE / SUMMARY / INTENT_CHECK / INTENT_EXECUTE / LLM_REASONING
    message    = Column(Text)
    order_ref  = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class AgentRecommendation(Base):
    __tablename__ = "agent_recommendations"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    run_id              = Column(Text, nullable=False)
    agent_name          = Column(Text, nullable=False)
    rec_type            = Column(Text, nullable=False)   # DO / PurchaseRequisition / RepairReservation
    product_id          = Column(Integer, ForeignKey("products.id"))
    from_location_id    = Column(Integer, ForeignKey("locations.id"), nullable=True)
    to_location_id      = Column(Integer, ForeignKey("locations.id"), nullable=True)
    qty                 = Column(Integer)
    shortage_qty        = Column(Integer)
    estimated_value     = Column(Float)
    status              = Column(Text, nullable=False, default="Pending")
    order_ref           = Column(Text)
    notes               = Column(Text)
    created_at          = Column(TIMESTAMP, server_default=func.current_timestamp())
    actioned_at         = Column(TIMESTAMP)
    actioned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product             = relationship("Product")
    from_location       = relationship("Location", foreign_keys=[from_location_id])
    to_location         = relationship("Location", foreign_keys=[to_location_id])
    actioned_by         = relationship("User", foreign_keys=[actioned_by_user_id])
