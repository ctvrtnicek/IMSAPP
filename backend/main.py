from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, init_database
from models import Base  # noqa: F401 — ensures all models are registered
from routers import auth as auth_router
from routers import locations as locations_module
from routers import suppliers as suppliers_module
from routers import products as products_module
from routers import customers as customers_module
from routers import inventory as inventory_module
from routers import terminal_states as terminal_states_module
from routers import purchase_orders as po_module
from routers import outbound_orders as outbound_orders_module
from routers import warehouse as warehouse_module
from routers import returns as returns_module
from routers import users as users_module
from routers import analytics as analytics_module
from routers import upload as upload_module
from routers import repair_rework as repair_rework_module
from routers import business_calendars as business_calendars_module
from routers import cost_master as cost_master_module
from routers import work_orders as work_orders_module
from routers import claims as claims_module
from routers import demand_planning as demand_planning_module
from routers import supply_planning as supply_planning_module
from routers import alerts as alerts_module
from routers import system_config as system_config_module
from routers import search as search_module
from routers import network_design as network_design_module
from routers import firmware as firmware_module
from routers import agents as agents_module
from routers import atp as atp_module
from routers import traceability as traceability_module
from routers import admin_db as admin_db_module

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Inventory Management System API",
    version="1.3",
    description="Inventory Management System — Backend API",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://imsapp-dev.netlify.app",
        "https://calm-jelly-3201a8.netlify.app",  # old/reference URL, kept in case it's revived
    ],
    allow_origin_regex=r"https://.*--imsapp-dev\.netlify\.app",  # Netlify deploy previews
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router.router)

# Phase 1B — Master Data routers
app.include_router(locations_module.location_types_router)
app.include_router(locations_module.locations_router)
app.include_router(suppliers_module.router)
app.include_router(products_module.router)
app.include_router(customers_module.router)

# Phase 1B #2 — Inventory routers
app.include_router(terminal_states_module.router)
app.include_router(inventory_module.router)

# Phase 1C — Purchase Orders router
app.include_router(po_module.router)

# Phase 1D — Outbound Orders router
app.include_router(outbound_orders_module.router)

# Phase 1E — Warehouse / State-Update router
app.include_router(warehouse_module.router)

# Phase 1E — Returns & Repairs router
app.include_router(returns_module.router)

# Admin — Users & Roles router
app.include_router(users_module.router)

# Analytics router
app.include_router(analytics_module.router)

# Upload router
app.include_router(upload_module.router)

# Repair & Rework router (v1.3)
app.include_router(repair_rework_module.router)

# Business Calendars router (v1.3)
app.include_router(business_calendars_module.router)

# Cost Engine master data router (Phase 2D)
app.include_router(cost_master_module.router)

# Work Orders router (Phase 2F)
app.include_router(work_orders_module.router)

# Claims router (Phase 2G)
app.include_router(claims_module.router)

# Demand Planning router (Phase 2H)
app.include_router(demand_planning_module.router)

# Supply Planning + Repositioning router (Phase 2I)
app.include_router(supply_planning_module.router)

# Alerts router (Phase 2K)
app.include_router(alerts_module.router)

# Phase 3A — System Config
app.include_router(system_config_module.router)

# Phase 3A — Global Search
app.include_router(search_module.router)

# Phase 3B — Network Design (regions, countries, versions, flows)
app.include_router(network_design_module.router)

# Phase 3B — Firmware master data
app.include_router(firmware_module.router)

# R3 — Available to Promise
app.include_router(atp_module.router)

# R3 — Traceability & RMA
app.include_router(traceability_module.router)

# R3 — Inventory Shortage Agent
app.include_router(agents_module.router)

# Admin — DB schema/seed diagnostics
app.include_router(admin_db_module.router)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
DB_PATH = Path(__file__).parent / "terminal_tracking.db"


@app.on_event("startup")
def on_startup():
    # schema.sql / schema_postgres.sql is the source of truth for table structure
    # (kept in sync with local dev via backend/tools/generate_pg_schema.py) — it
    # must run *before* the ORM's create_all, otherwise create_all creates any
    # not-yet-existing tables using models.py's (possibly incomplete) column set,
    # and the fuller schema.sql definition then silently no-ops because the table
    # already exists. On Postgres this runs on every fresh container start (the
    # free tier has no persistent app disk, so DB_PATH never survives a restart);
    # it's safe because schema creation is idempotent and every seed.sql INSERT
    # uses ON CONFLICT DO NOTHING.
    if engine.dialect.name == "postgresql" or not DB_PATH.exists():
        print("Initialising database schema + seed data …")
        try:
            init_database()
        except FileNotFoundError:
            pass  # schema file optional; ORM tables created below as a fallback
        print("Database initialised.")
    # Safety net for any ORM-only tables not (yet) covered by the schema file.
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "version": "1.0"}
