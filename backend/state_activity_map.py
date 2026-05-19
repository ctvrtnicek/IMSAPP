"""
state_activity_map.py — Canonical activity description per terminal state (PRD v1.1 §8.1.7).
Used to auto-populate StateHistory.activity_description on every state transition.
"""

STATE_ACTIVITY_DESCRIPTIONS = {
    "EXPECTING":                            "PO raised; serial assigned by supplier; not yet received at warehouse",
    "QUARANTINE":                           "Received from vendor; awaiting staging",
    "ENCRYPTION_KEY_LOADED":               "Encryption key loaded onto terminal",
    "STAGING":                             "VAS activities in progress (firmware, kitting, battery charge, packaging)",
    "AVAILABLE":                            "Available to sell or distribute",
    "TRANSIT_TO_COMPANY":                  "Shipped to customer",
    "RECEIVED":                             "Delivered to and confirmed by customer",
    "CUSTOMER_DELIVERY_FAILED":            "Delivery attempt failed at customer location",
    "DEFECT":                              "Terminal returned as defective",
    "UNDER_INVESTIGATION":                 "Warehouse review of defective terminal",
    "TRANSIT_TO_REPAIR":                   "Dispatched to authorised repair centre",
    "IN_REPAIR":                           "At repair centre; repair in progress",
    "REPAIR_DELIVERY_FAILED":              "Delivery to repair centre failed",
    "QUARANTINE_REFURBISHED":              "Returned from repair; awaiting quality check",
    "AVAILABLE_REFURBISHED":               "Refurbished and available to sell or distribute",
    "TRANSIT_TO_WAREHOUSE":                "In transit between warehouses",
    "RECEIVED_AT_DESTINATION_WAREHOUSE":   "Received at destination warehouse",
    "DESTINATION_WAREHOUSE_DELIVERY_FAILED": "Inter-warehouse delivery failed",
    "DESTROYED":                           "Terminal scrapped, destroyed, or end of lifecycle",
}


def get_activity_description(state_code: str) -> str | None:
    """Return the canonical activity description for a state code, or None if unknown."""
    return STATE_ACTIVITY_DESCRIPTIONS.get(state_code.upper() if state_code else "")
