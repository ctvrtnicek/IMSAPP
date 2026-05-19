from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
from datetime import date


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str
    active: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Phase 1B — Master Data schemas
# ---------------------------------------------------------------------------

# ── Location Types ──────────────────────────────────────────────────────────

class LocationTypeCreate(BaseModel):
    name: str


class LocationTypeOut(BaseModel):
    id: int
    name: str
    active: int

    model_config = {"from_attributes": True}


# ── Locations ───────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    code: str
    name: str
    location_type_id: int
    country: str
    city: Optional[str] = None
    reporting_currency: str = "EUR"


class LocationUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    location_type_id: Optional[int] = None
    country: Optional[str] = None
    city: Optional[str] = None
    reporting_currency: Optional[str] = None
    active: Optional[int] = None


class LocationOut(BaseModel):
    id: int
    code: str
    name: str
    location_type_id: int
    country: str
    city: Optional[str] = None
    reporting_currency: str
    active: int
    location_type_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Suppliers ───────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    code: str
    name: str
    country: str
    city: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class SupplierUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    active: Optional[int] = None


class SupplierOut(BaseModel):
    id: int
    code: str
    name: str
    country: str
    city: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    active: int

    model_config = {"from_attributes": True}


# ── Products ────────────────────────────────────────────────────────────────

class ProductTypeEnum(str, Enum):
    payment_terminal = "Payment Terminal"
    accessory = "Accessory"
    battery = "Battery"


class ProductCategoryEnum(str, Enum):
    payment_device = "PaymentDevice"
    serialized_accessory = "SerializedAccessory"
    accessory = "Accessory"


class ProductCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    product_type: ProductTypeEnum
    product_category: ProductCategoryEnum
    serialised: int = 0
    is_bom: int = 0
    unit_value: Optional[float] = None
    unit_currency: str = "EUR"
    refurb_unit_value: Optional[float] = None
    refurb_unit_currency: Optional[str] = None
    hs_code: Optional[str] = None
    battery_life_days: Optional[int] = None
    warranty_days: Optional[int] = None
    repair_max_days: Optional[int] = None


class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[ProductTypeEnum] = None
    product_category: Optional[ProductCategoryEnum] = None
    serialised: Optional[int] = None
    is_bom: Optional[int] = None
    unit_value: Optional[float] = None
    unit_currency: Optional[str] = None
    refurb_unit_value: Optional[float] = None
    refurb_unit_currency: Optional[str] = None
    hs_code: Optional[str] = None
    active: Optional[int] = None
    battery_life_days: Optional[int] = None
    warranty_days: Optional[int] = None
    repair_max_days: Optional[int] = None


class ProductOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    product_type: str
    product_category: str
    serialised: int
    is_bom: int
    unit_value: Optional[float] = None
    unit_currency: Optional[str] = None
    refurb_unit_value: Optional[float] = None
    refurb_unit_currency: Optional[str] = None
    hs_code: Optional[str] = None
    active: int
    battery_life_days: Optional[int] = None
    warranty_days: Optional[int] = None
    repair_max_days: Optional[int] = None
    has_image: Optional[bool] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        if hasattr(obj, 'image_data'):
            instance.has_image = bool(obj.image_data)
        return instance


# ── Customers ───────────────────────────────────────────────────────────────

class CustomerTypeEnum(str, Enum):
    shop = "Shop"
    merchant = "Merchant"
    distributor = "Distributor"
    partner = "Partner"


class CustomerCreate(BaseModel):
    customer_ref: str
    duns_number: Optional[str] = None
    name: str
    customer_type: CustomerTypeEnum
    country: str
    state_region: Optional[str] = None
    credit_rating: Optional[str] = None
    delivery_address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class CustomerUpdate(BaseModel):
    customer_ref: Optional[str] = None
    duns_number: Optional[str] = None
    name: Optional[str] = None
    customer_type: Optional[CustomerTypeEnum] = None
    country: Optional[str] = None
    state_region: Optional[str] = None
    credit_rating: Optional[str] = None
    delivery_address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    active: Optional[int] = None


class CustomerOut(BaseModel):
    id: int
    customer_ref: str
    duns_number: Optional[str] = None
    name: str
    customer_type: str
    country: str
    state_region: Optional[str] = None
    credit_rating: Optional[str] = None
    delivery_address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    active: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Phase 1B #2 — Inventory schemas
# ---------------------------------------------------------------------------

# ── Terminal States ──────────────────────────────────────────────────────────
class TerminalStateCreate(BaseModel):
    code: str
    display_name: str
    warehouse_type: Optional[str] = None
    description: Optional[str] = None
    sequence_number: Optional[int] = None
    expected_duration_value: Optional[float] = None
    expected_duration_unit: Optional[str] = None  # "Hours" | "Days"
    valid_location_type_ids: Optional[List[int]] = None


class TerminalStateOut(BaseModel):
    id: int
    code: str
    display_name: str
    warehouse_type: Optional[str] = None
    description: Optional[str] = None
    active: int
    sequence_number: Optional[int] = None
    expected_duration_value: Optional[float] = None
    expected_duration_unit: Optional[str] = None
    valid_location_type_ids: Optional[List[int]] = None

    model_config = {"from_attributes": True}


# ── Serial Numbers ───────────────────────────────────────────────────────────
class SerialNumberOut(BaseModel):
    id: int
    serial_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    product_id: int
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    current_state_id: Optional[int] = None
    current_state_code: Optional[str] = None
    current_state_name: Optional[str] = None
    current_location_id: Optional[int] = None
    current_location_code: Optional[str] = None
    current_location_name: Optional[str] = None
    stock_type: str
    security_seal: int
    key_loaded: int
    active: int
    accumulated_cost: float
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ── State History ────────────────────────────────────────────────────────────
class StateHistoryOut(BaseModel):
    id: int
    state_code: Optional[str] = None
    state_name: Optional[str] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    datetime_utc: Optional[str] = None
    timezone: str
    actor_type: str
    actor_username: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Non-Serialised Inventory ─────────────────────────────────────────────────
class NonSerialisedOut(BaseModel):
    id: int
    product_id: int
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    location_id: int
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    state: str
    quantity: int

    model_config = {"from_attributes": True}


class NonSerialisedUpdate(BaseModel):
    quantity: int
    state: Optional[str] = None


class NonSerialisedCreate(BaseModel):
    product_id: int
    location_id: int
    state: str = "Available"
    quantity: int = 0


# ---------------------------------------------------------------------------
# Phase 1C — Purchase Orders schemas
# ---------------------------------------------------------------------------

# ── Purchase Orders ──────────────────────────────────────────────────────────

class POLineCreate(BaseModel):
    product_id: int
    qty_ordered: int


class POLineOut(BaseModel):
    id: int
    line_number: int
    product_id: int
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    qty_ordered: int
    qty_expected: int
    qty_received: int
    model_config = {"from_attributes": True}


class POCreate(BaseModel):
    supplier_id: int
    destination_location_id: int
    order_date: str  # YYYY-MM-DD
    expected_arrival_date: Optional[str] = None
    notes: Optional[str] = None
    lines: List[POLineCreate]


class POUpdate(BaseModel):
    expected_arrival_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class POOut(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    destination_location_id: int
    destination_location_code: Optional[str] = None
    destination_location_name: Optional[str] = None
    order_date: str
    expected_arrival_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    lines: List[POLineOut] = []
    model_config = {"from_attributes": True}


# ── Serial Number Import (inbound upload) ────────────────────────────────────

class SerialImportRow(BaseModel):
    serial_number: str
    product_code: str


class SerialImportPayload(BaseModel):
    po_id: int
    shipment_reference: Optional[str] = None
    carrier: Optional[str] = None
    carrier_tracking_ref: Optional[str] = None
    estimated_arrival_date: Optional[str] = None
    serials: List[SerialImportRow]


class SerialImportResult(BaseModel):
    total: int
    created: int
    duplicates: int
    errors: List[str] = []


# ---------------------------------------------------------------------------
# Phase 1D — Outbound Orders schemas
# ---------------------------------------------------------------------------

# ── Outbound Orders ──────────────────────────────────────────────────────────

class OutboundLineCreate(BaseModel):
    product_id: int
    quantity: int


class OutboundLineOut(BaseModel):
    id: int
    line_number: int
    product_id: int
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    quantity: int
    model_config = {"from_attributes": True}


class OutboundOrderCreate(BaseModel):
    order_type: str  # Sales, Rental, Replacement, Distribution
    customer_id: Optional[int] = None
    destination_location_id: Optional[int] = None  # for Distribution
    fulfilling_location_id: Optional[int] = None
    notes: Optional[str] = None
    # Rental-specific
    rental_period_months: Optional[int] = 12
    rental_fee: Optional[float] = None
    rental_fee_currency: Optional[str] = None
    lines: List[OutboundLineCreate]


class OutboundOrderUpdate(BaseModel):
    status: Optional[str] = None
    fulfilling_location_id: Optional[int] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    shipped_date: Optional[str] = None
    estimated_arrival_date: Optional[str] = None
    shipping_cost: Optional[float] = None
    shipping_cost_currency: Optional[str] = None
    atp_ship_date: Optional[str] = None
    atp_delivery_date: Optional[str] = None
    atp_feasible: Optional[int] = None


class OutboundSerialOut(BaseModel):
    id: int
    serial_number: str
    product_code: Optional[str] = None
    current_state_code: Optional[str] = None
    current_location_code: Optional[str] = None
    model_config = {"from_attributes": True}


class OutboundOrderOut(BaseModel):
    id: int
    order_number: str
    order_type: str
    status: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    destination_location_id: Optional[int] = None
    destination_location_code: Optional[str] = None
    fulfilling_location_id: Optional[int] = None
    fulfilling_location_code: Optional[str] = None
    atp_ship_date: Optional[str] = None
    atp_delivery_date: Optional[str] = None
    atp_feasible: Optional[int] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    shipped_date: Optional[str] = None
    estimated_arrival_date: Optional[str] = None
    shipping_cost: Optional[float] = None
    shipping_cost_currency: Optional[str] = None
    rental_period_months: Optional[int] = None
    rental_fee: Optional[float] = None
    rental_fee_currency: Optional[str] = None
    rental_expected_return_date: Optional[str] = None
    created_at: Optional[str] = None
    lines: List[OutboundLineOut] = []
    allocated_serials: List[dict] = []
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Phase 1E — Returns & Repairs schemas
# ---------------------------------------------------------------------------

# ── Return Orders ────────────────────────────────────────────────────────────

class ReturnOrderCreate(BaseModel):
    customer_id: Optional[int] = None
    original_order_id: Optional[int] = None
    reason: str  # Defective, End of Rental, End of Lifecycle, Wrong Item, Other
    serial_ids: Optional[List[int]] = None        # list of serial DB ids (legacy)
    serial_numbers: Optional[List[str]] = None    # list of serial number strings (preferred)


class ReturnOrderUpdate(BaseModel):
    status: Optional[str] = None
    inspection_outcome: Optional[str] = None  # Defective or Scrap


class ReturnOrderOut(BaseModel):
    id: int
    order_number: str
    original_order_id: Optional[int] = None
    original_order_number: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    reason: str
    status: str
    inspection_outcome: Optional[str] = None
    linked_replacement_order_id: Optional[int] = None
    created_at: Optional[str] = None
    serials: List[dict] = []
    model_config = {"from_attributes": True}


# ── Repair Orders ────────────────────────────────────────────────────────────

class RepairOrderCreate(BaseModel):
    return_order_id: Optional[int] = None
    repair_centre_location_id: int
    serial_ids: List[int]
    dispatch_date: Optional[str] = None
    estimated_return_date: Optional[str] = None
    return_location_id: Optional[int] = None


class RepairOrderUpdate(BaseModel):
    status: Optional[str] = None
    outcome: Optional[str] = None
    actual_cost: Optional[float] = None
    actual_cost_currency: Optional[str] = None
    repair_notes: Optional[str] = None
    estimated_return_date: Optional[str] = None
    actual_return_date: Optional[str] = None


class RepairOrderOut(BaseModel):
    id: int
    order_number: str
    return_order_id: Optional[int] = None
    repair_centre_location_id: int
    repair_centre_name: Optional[str] = None
    dispatch_date: Optional[str] = None
    estimated_return_date: Optional[str] = None
    actual_return_date: Optional[str] = None
    return_location_id: Optional[int] = None
    return_location_name: Optional[str] = None
    status: str
    outcome: Optional[str] = None
    actual_cost: Optional[float] = None
    actual_cost_currency: Optional[str] = None
    repair_notes: Optional[str] = None
    created_at: Optional[str] = None
    serials: List[dict] = []
    model_config = {"from_attributes": True}
