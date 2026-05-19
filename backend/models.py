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
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


# ---------------------------------------------------------------------------
# Master Data models
# ---------------------------------------------------------------------------

class LocationType(Base):
    __tablename__ = "location_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
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
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    current_state = relationship("TerminalState")
    current_location = relationship("Location")
    supplier = relationship("Supplier")
    product = relationship("Product")


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
    order = relationship("OutboundOrder", back_populates="lines")
    product = relationship("Product")


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
