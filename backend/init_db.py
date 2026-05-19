"""
init_db.py — one-time setup script.

Run this before starting the server for the first time:
    python init_db.py

It will:
  1. Create the SQLite database by executing schema.sql
  2. Seed the five test users with bcrypt-hashed passwords
  3. Seed master data (location types, locations, suppliers)
"""

import sys
from pathlib import Path

# Allow importing sibling modules when run as a script
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, engine, init_database, Base
from models import User, LocationType, Location, Supplier, TerminalState
from auth import get_password_hash


SEED_USERS = [
    {"username": "admin",     "password": "admin123",     "role": "admin"},
    {"username": "planner",   "password": "planner123",   "role": "supply_planner"},
    {"username": "warehouse", "password": "warehouse123", "role": "warehouse_user"},
    {"username": "repair",    "password": "repair123",    "role": "repair_centre"},
    {"username": "supplier",  "password": "supplier123",  "role": "supplier"},
]

# (code, name, country, city, currency, location_type_name)
SEED_LOCATIONS = [
    ("Oostrum",    "Oostrum Warehouse",    "Netherlands", "Oostrum",    "EUR", "Warehouse"),
    ("DHLAU",      "DHL Australia",        "Australia",   "Sydney",     "AUD", "Warehouse"),
    ("Memphis",    "Memphis Warehouse",    "USA",         "Memphis",    "USD", "Warehouse"),
    ("Sacramento", "Sacramento Warehouse", "USA",         "Sacramento", "USD", "Warehouse"),
    ("Sorocaba",   "Sorocaba Warehouse",   "Brazil",      "Sorocaba",   "BRL", "Warehouse"),
    ("Changi",     "Changi Singapore",     "Singapore",   "Singapore",  "SGD", "Warehouse"),
    ("FSLUK",      "FSL United Kingdom",   "UK",          None,         "GBP", "FSL"),
    ("FSLMX",      "FSL Mexico",           "Mexico",      None,         "MXN", "FSL"),
    ("FSLSG",      "FSL Singapore",        "Singapore",   None,         "SGD", "FSL"),
    ("FSLJP",      "FSL Japan",            "Japan",       None,         "JPY", "FSL"),
    ("FSLBrazil",  "FSL Brazil",           "Brazil",      None,         "BRL", "FSL"),
]

# (code, name, country, city)
SEED_SUPPLIERS = [
    ("Castles",         "Castles",                 "Italy",       None),
    ("CastlesBrazil",   "Castles Brazil",          "Brazil",      None),
    ("CastlesUS",       "Castles US",              "USA",         None),
    ("VerifoneEU",      "Verifone EU",             "Poland",      None),
    ("VerifoneUS",      "Verifone US",             "USA",         None),
    ("Datecs",          "Datecs",                  "Bulgaria",    None),
    ("HAVIS",           "HAVIS",                   "USA",         None),
    ("VadeloBV",        "Vadelo BV",               "Netherlands", None),
    ("KPNBV",           "KPN BV",                  "Netherlands", None),
    ("BradyBV",         "Brady BV",                "Netherlands", None),
    ("AvendesoraTL",    "Avendesora Trading Ltd.", "Ireland",     None),
]


TERMINAL_STATES = [
    {"code": "EXPECTING",                             "display_name": "Expecting",                             "warehouse_type": "Pre-Warehouse",    "description": "PO raised; serial assigned by supplier; not yet received"},
    {"code": "QUARANTINE",                            "display_name": "Quarantine",                            "warehouse_type": "Live",             "description": "Received from vendor; awaiting staging"},
    {"code": "ENCRYPTION_KEY_LOADED",                 "display_name": "Encryption Key Loaded",                 "warehouse_type": "Live",             "description": "Encryption key loaded onto terminal"},
    {"code": "STAGING",                               "display_name": "Staging",                               "warehouse_type": "Live",             "description": "VAS activities in progress"},
    {"code": "AVAILABLE",                             "display_name": "Available",                             "warehouse_type": "Live",             "description": "Available to sell or distribute"},
    {"code": "TRANSIT_TO_COMPANY",                    "display_name": "Transit to Company",                    "warehouse_type": "Out-Warehouse",    "description": "Shipped to customer"},
    {"code": "RECEIVED",                              "display_name": "Received",                              "warehouse_type": "Out-Warehouse",    "description": "Delivered to and confirmed by customer"},
    {"code": "CUSTOMER_DELIVERY_FAILED",              "display_name": "Customer Delivery Failed",              "warehouse_type": "Out-Warehouse",    "description": "Delivery attempt failed at customer location"},
    {"code": "DEFECT",                                "display_name": "Defect",                                "warehouse_type": "Live",             "description": "Terminal returned as defective"},
    {"code": "UNDER_INVESTIGATION",                   "display_name": "Under Investigation",                   "warehouse_type": "Live",             "description": "Warehouse review of defective terminal"},
    {"code": "TRANSIT_TO_REPAIR",                     "display_name": "Transit to Repair",                     "warehouse_type": "Out-Warehouse",    "description": "Dispatched to authorised repair centre"},
    {"code": "IN_REPAIR",                             "display_name": "In Repair",                             "warehouse_type": "Out-Warehouse",    "description": "At repair centre; repair in progress"},
    {"code": "REPAIR_DELIVERY_FAILED",                "display_name": "Repair Delivery Failed",                "warehouse_type": "Out-Warehouse",    "description": "Delivery to repair centre failed"},
    {"code": "QUARANTINE_REFURBISHED",                "display_name": "Quarantine Refurbished",                "warehouse_type": "Refurbished Live", "description": "Returned from repair; awaiting quality check"},
    {"code": "AVAILABLE_REFURBISHED",                 "display_name": "Available Refurbished",                 "warehouse_type": "Refurbished Live", "description": "Refurbished and available to sell"},
    {"code": "TRANSIT_TO_WAREHOUSE",                  "display_name": "Transit to Warehouse",                  "warehouse_type": "Out-Warehouse",    "description": "In transit between warehouses"},
    {"code": "RECEIVED_AT_DESTINATION_WAREHOUSE",     "display_name": "Received at Destination Warehouse",     "warehouse_type": "Out-Warehouse",    "description": "Received at destination warehouse"},
    {"code": "DESTINATION_WAREHOUSE_DELIVERY_FAILED", "display_name": "Destination Warehouse Delivery Failed", "warehouse_type": "Out-Warehouse",    "description": "Inter-warehouse delivery failed"},
    {"code": "SCRAP",                                 "display_name": "Scrap / Destroyed",                     "warehouse_type": "End State",        "description": "Terminal scrapped or end of lifecycle"},
]


def seed_terminal_states(db):
    for ts_data in TERMINAL_STATES:
        existing = db.query(TerminalState).filter(TerminalState.code == ts_data["code"]).first()
        if existing:
            print(f"  [skip] TerminalState '{ts_data['code']}' already exists.")
            continue
        ts = TerminalState(
            code=ts_data["code"],
            display_name=ts_data["display_name"],
            warehouse_type=ts_data["warehouse_type"],
            description=ts_data["description"],
            active=1,
        )
        db.add(ts)
        print(f"  [create] TerminalState '{ts_data['code']}' ({ts_data['display_name']})")
    db.commit()


def seed_users(db):
    for user_data in SEED_USERS:
        existing = db.query(User).filter(User.username == user_data["username"]).first()
        if existing:
            print(f"  [skip] User '{user_data['username']}' already exists.")
            continue
        user = User(
            username=user_data["username"],
            password_hash=get_password_hash(user_data["password"]),
            role=user_data["role"],
            active=1,
        )
        db.add(user)
        print(f"  [create] User '{user_data['username']}' (role: {user_data['role']})")
    db.commit()


def seed_master_data(db):
    # ── Location Types ──────────────────────────────────────────────────────
    location_type_names = ["Warehouse", "FSL", "Repair Centre", "Supplier"]
    lt_map = {}
    for lt_name in location_type_names:
        existing = db.query(LocationType).filter(LocationType.name == lt_name).first()
        if existing:
            print(f"  [skip] LocationType '{lt_name}' already exists.")
            lt_map[lt_name] = existing
        else:
            lt = LocationType(name=lt_name, active=1)
            db.add(lt)
            db.flush()  # get the id before commit
            lt_map[lt_name] = lt
            print(f"  [create] LocationType '{lt_name}'")
    db.commit()

    # Re-fetch to ensure IDs are populated
    for lt_name in location_type_names:
        lt_map[lt_name] = db.query(LocationType).filter(LocationType.name == lt_name).first()

    # ── Locations ────────────────────────────────────────────────────────────
    for code, name, country, city, currency, lt_name in SEED_LOCATIONS:
        existing = db.query(Location).filter(Location.code == code).first()
        if existing:
            print(f"  [skip] Location '{code}' already exists.")
            continue
        lt = lt_map.get(lt_name)
        if not lt:
            print(f"  [warn] LocationType '{lt_name}' not found, skipping location '{code}'")
            continue
        loc = Location(
            code=code,
            name=name,
            location_type_id=lt.id,
            country=country,
            city=city,
            reporting_currency=currency,
            active=1,
        )
        db.add(loc)
        print(f"  [create] Location '{code}' ({name})")
    db.commit()

    # ── Suppliers ────────────────────────────────────────────────────────────
    for code, name, country, city in SEED_SUPPLIERS:
        existing = db.query(Supplier).filter(Supplier.code == code).first()
        if existing:
            print(f"  [skip] Supplier '{code}' already exists.")
            continue
        supplier = Supplier(
            code=code,
            name=name,
            country=country,
            city=city,
            active=1,
        )
        db.add(supplier)
        print(f"  [create] Supplier '{code}' ({name})")
    db.commit()


def main():
    print("Step 1: Initialising database …")
    # Create all ORM-defined tables (idempotent)
    Base.metadata.create_all(bind=engine)
    # Also run schema.sql for any raw SQL structures
    try:
        init_database()
    except FileNotFoundError:
        print("  [warn] schema.sql not found — relying on ORM metadata only.")
    print("  Done.")

    print("Step 2: Seeding test users …")
    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()

    print("Step 3: Seeding master data …")
    db = SessionLocal()
    try:
        seed_master_data(db)
    finally:
        db.close()

    print("Step 4: Seeding terminal states …")
    db = SessionLocal()
    try:
        seed_terminal_states(db)
    finally:
        db.close()

    print("\nDatabase ready. You can now start the server:")
    print("  uvicorn main:app --reload")


if __name__ == "__main__":
    main()
