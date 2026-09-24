<!-- Reference only: PRD v3.0 (converted from SPECS/IMS - PRD v3.0 Consolidated_new.docx).
     Where it differs from process_guide.md, the process guide describes the real system. -->

INVENTORY MANAGEMENT SYSTEM
(Terminal Tracking & planning Application)
Product Requirements Document
Version
v3.0 — Consolidated  (R1 complete · R2 delivered · R3 in progress: 3A+3B delivered)
Date
May 2026
Author
Jakub Ctvrtnicek
Customer
Terminal Distributor
App Name
Inventory Management System (IMS)
Classification
Confidential
Local URL
http://localhost:3000
Folder
C:\IMSAPP
Previous
v2.2 Consolidated (R1 complete · R2 delivered · R3 3A+3B delivered)
Status
R1 delivered · R2 delivered · R3 in progress (3A + 3B delivered)
Source Code
GitHub (uploaded after R2 completion)

# 1.  VERSION HISTORY

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | May 2026 | Jakub Ctvrtnicek | Initial PRD draft — R1 scope defined |
| v1.1 | May 2026 | Jakub Ctvrtnicek | Supplier role, Business Objects, Views, Transit Time Master, Exchange Rate, Order Numbering, state history 1:N, return/repair updates, mass upload expansion |
| v1.2 | May 2026 | Jakub Ctvrtnicek | R1 complete. R1 patch items. R2 scope: inventory enhancements, cost calculation, cost KPI dashboards. API integration deferred. |
| v1.3 | May 2026 | Jakub Ctvrtnicek | Consolidated. Serial number fields enhanced. Data model updated from customer sample files. Dispatch/Repair & Rework. R2 planning features fully specified. |
| v2.0 | May 2026 | Jakub Ctvrtnicek | R2 complete and tested. Source code uploaded to GitHub. R3 in preparation. |
| v2.1 | May 2026 | Jakub Ctvrtnicek | R3 full scope defined: 17 requirements covering Network Design, ATP, BOM, Quality Hold, RMA, Portals, AI Document Processing, AI Assistant, RBAC, and UX enhancements. |
| v2.2 | May 2026 | Jakub Ctvrtnicek | Phase 3A (Foundations) and Phase 3B (Master Data) delivered and tested. Source code uploaded to GitHub. Document updated to v2.2. |
| v3.0 | June 2026 | Jakub Ctvrtnicek | Appendix B added: Agentic IMS — IMS_Procurement Agent Design. Document updated to v3.0. |


# 2.  EXECUTIVE SUMMARY
The Inventory Management System (IMS) is a purpose-built standalone web application for Terminal Distributor — a global payment terminal distributor managing serialised payment devices across a worldwide warehouse network.  IMS is the master system of record for terminal serial number tracking, inventory counts, order management, cost calculation, demand and supply planning, and — from R3 — intelligent supply network design, available-to-promise, and AI-assisted operations.
Release 1 and Release 2 are complete, fully tested, and source code has been uploaded to GitHub. Release 3 is in progress: Phase 3A (Foundations) and Phase 3B (Master Data) have been delivered. The application runs locally at http://localhost:3000 in C:\IMSAPP. This document (v2.2) provides a consolidated summary of R1 and R2 deliveries, confirms 3A and 3B delivery status, and retains the complete functional specification for Release 3’s remaining phases.
Technology stack: React + Vite frontend · Python FastAPI backend · SQLite (local) → PostgreSQL (server) · Tailwind CSS · JWT auth · Anthropic Claude API (R3 AI features).

# 3.  RELEASE DELIVERY SUMMARY

## 3.1  Release 1 — Delivered

| Module / Feature | Status |
|---|---|
| Master Data — Products/BOM, Suppliers, Locations, Transit Times, Assembly Times, Business Calendars, Customers, Terminal States, Activity Costs, Exchange Rates, Order Numbering | Delivered |
| Serial Number Tracking + Configurable State Machine + Immutable 1:N State History | Delivered |
| Accessories Inventory (non-serialised count per location) | Delivered |
| Inbound Flow — PO Header + Lines, Serial Import (XLS), Receipt Confirmation | Delivered |
| Sales Orders (SO), Rental Orders (RN), Replacement Orders (RP) | Delivered |
| Distribution Orders (DS) — inter-warehouse transfers | Delivered |
| Repair & Rework Orders (RR) — dispatch and inbound return | Delivered |
| Return Orders (RE) — Scrap and Defective outcomes | Delivered |
| Mass Upload Centre — templates for all entity types | Delivered |
| Analytics & KPI Dashboard | Delivered |
| User Roles & Auth — Admin, Supply Planner, Warehouse User, Repair Centre, Supplier | Delivered |
| Terminal Detail — full screen, state history, order hyperlinks | Delivered |
| API Integration Module (stub/scaffold) | Delivered — not activated |


## 3.2  R1 Patch Items Applied

| ID | Change | Description |
|---|---|---|
| P-01 | App renamed | Application title updated to Inventory Management System (IMS) |
| P-02 | e2open teal navbar | Navbar colour: #1A6B7B |
| P-03 | Nav: Warehouse Tasks | Warehouse + Upload merged into Warehouse Tasks |
| P-04 | Nav: Admin | Master Data + Admin merged into Admin |
| P-05 | In Transit label | Expecting renamed to In Transit in UI |
| P-06 | Accessories label | Non-Serialised Inventory renamed to Accessories in UI |


## 3.3  Release 2 — Delivered

| Phase | Module | Key Deliverables |
|---|---|---|
| 2A | R1 Patches | All 6 patch items applied. |
| 2B | Inventory Enhancements | Latest Date/Location columns; In Transit expanded to all transit states; column filtering on all views. |
| 2C | PO Received Date | ReceivedDate on PO header and lines; visible in detail and export. |
| 2D | Cost Calculation Engine | Activity cost per state transition; FX conversion; accumulated cost per serial. |
| 2E | Cost KPI Dashboards | 4 analytics views: Cost Per Serial, By Location, By Product Family, Repair Cost Analysis. All exportable. |
| 2F | Work Orders | Auto-generated assembly instructions for multi-location BOM fulfilment. |
| 2G | Claims Management | Configurable claim types; claim raised on PO receipt discrepancy. |
| 2H | Demand Planning | Demand Planner role; demand signals; forward demand forecasting. |
| 2I | Supply Planning + Repositioning | Safety stock targets; replenishment engine; gap/overflow dashboard; repositioning planner. |
| 2J | Purchase Prediction | Forecast future POs from demand signals + supplier lead times. |
| 2K | Alerting Framework | 6 configurable alert rules; in-app bell icon + email notifications. New state: RECHARGED. |
| 2L | API Integration | Live GET/POST with external Logistics API. (Spec addendum TBD.) |

Out of scope for R1 and R2: ERP integration, carrier booking, invoice generation, financial reporting.

# 4.  RELEASE 3 — SCOPE OVERVIEW
Release 3 introduces 17 requirements across six phases.  The primary themes are: foundational RBAC and UX hardening; supply chain master data enrichment (Network Design, Product, Firmware); intelligent ATP and BOM-aware planning; role-specific portals with AI-powered document processing; and an embedded AI assistant.

| # | Requirement | Phase | Complexity |
|---|---|---|---|
| 1 | Returns for RMA / Traceability & Investigation | 3E | Medium |
| 2 | Menu Enhancement (collapsible text sidebar) | 3A | Low |
| 3 | Global Search (all objects) | 3A | Medium |
| 4 | Quality Hold state + PO price field | 3D | Low |
| 5 | Network Design (Regions, Countries, Supply Flows) | 3B | High |
| 6 | Product Master Update (pricing, alternatives, BOM leadtime) | 3B | Medium |
| 7 | System Configuration tab in Admin | 3A | Low |
| 8 | Available to Promise (ATP) — full regional + segment logic | 3C | High |
| 9 | BOM Process — inbound multi-supplier + outbound ATP | 3C | Medium |
| 10 | Firmware Enhancement (master data + terminal link) | 3B | Low |
| 11 | Outbound Allocation — priority-based reallocation | 3C | Medium |
| 12 | AI Assistant (proactive, alert-aware) | 3F | Medium |
| 13 | Page & Size Alignment (UI fix) | 3A | Low |
| 14 | User Roles & Rights — full RBAC + location/region scoping | 3A | High |
| 15 | Supplier Portal + AI Document Processing | 3E | High |
| 16 | Repair Shop Portal | 3E | Low |
| 17 | Warehouse Portal | 3E | Low |

Explicitly deferred (not R3): Demand collaboration / S&OP, supply planning extensions, dynamic analytics, admin upload data synchronisation, alerting enhancements.

# 5.  R3 DETAILED REQUIREMENTS

## 5.1  User Roles & Rights (Phase 3A)
Phase: Phase 3A — Foundations   |   Release: R3

### Overview
Implement full role-based access control (RBAC) with location and region data scoping.  Users can hold multiple roles; where rights overlap, the strongest right takes precedence.  Admin manages roles and users through two dedicated sub-tabs.  Four new roles are introduced in R3: Inbound Specialist, Outbound Specialist, RMA Manager, and Senior Management.

### Functional Specification
- Roles defined: Admin, Supply Planner, Demand Planner, Warehouse User, Supplier User, Repair Center User (all R1/R2), plus new R3 roles: Inbound Specialist, Outbound Specialist, RMA Manager, Senior Management.
- Each role has a defined access matrix per functional area (Read / Read+Write / No Access) — see Roles & Rights matrix appended to this document.
- Multi-role assignment: Admin assigns one or more roles to each user.  Strongest right prevails where roles overlap.
- Location scoping: each user is assigned one or more Locations (warehouse or FSL); they can only see inventory, POs, outbound orders, and alerts for their assigned locations.
- Region scoping: internal roles (Supply Planner, Demand Planner, etc.) are assigned to one or more Regions; they see data for their regions only.
- Supplier and Repair Center scoping: Supplier or Repair center User is automatically linked to one Supplier entity; they see only their own POs.
- Admin → Roles tab: Admin can view and adjust rights per role per feature.  Changes take effect immediately.
- Admin → Users tab: Admin creates users, sets roles, and assigns location(s) or region(s).
- Menu visibility: navigation items that the user has no access to are hidden (see Req #2).
- For all new R3 features: role access rights to be confirmed by Jakub during sprint planning.

### Data Model Impact
- Table user_roles (many-to-many): user_id, role_id, assigned_at
- Table user_locations (many-to-many): user_id, location_id
- Table user_regions (many-to-many): user_id, region_id
- New roles added to roles table: inbound_specialist, outbound_specialist, rma_manager, senior_management
- All API endpoints enforce role + location/region scoping via JWT claims

## 5.2  System Configuration (Phase 3A)
Phase: Phase 3A — Foundations   |   Release: R3

### Overview
New "System Config" tab in the Admin section providing a centralised, admin-managed store for configurable system-wide switches and parameters.  Parameters identified during R3 development are registered here; the structure is extensible for future releases.

### Functional Specification
- New "System Config" tab in Admin, visible to Admin role only.
- Displays a list of configuration parameters: ConfigKey, Label, Description, DataType (string / integer / boolean / decimal), CurrentValue, DefaultValue, LastUpdatedAt, LastUpdatedBy.
- Admin can edit CurrentValue via inline edit; a confirmation dialog is shown before saving.
- Initial R3 parameters to register: AI_ASSISTANT_ENABLED (boolean), ANTHROPIC_API_KEY (string, masked), ATP_REALLOCATION_LOOKBACK_DAYS (integer, default 30), further parameters nominated during sprint.
- Audit log entry created on each config change.

### Data Model Impact
- New table system_config: id, config_key (UNIQUE), label, description, data_type, current_value, default_value, updated_at, updated_by_user_id

## 5.3  Menu Enhancement (Phase 3A)
Phase: Phase 3A — Foundations   |   Release: R3

### Overview
Replace the current icon-only left sidebar with a collapsible text-based navigation menu.  The menu displays module names alongside icons, supports expand/collapse behaviour, and respects role-based visibility — items the user cannot access are hidden.

### Functional Specification
- Left sidebar redesigned: grey background, module name text beside icon.
- Each top-level item can expand/collapse to reveal sub-items (currently represented as tabs within the module become sub-menu items).
- A collapse/expand toggle button at the top of the sidebar allows the sidebar to reduce to icon-only mode.
- Menu items are rendered based on the user's roles and permissions — hidden items are not shown (no "greyed out" state).
- No changes to underlying functional logic; this is a UI/navigation change only.
- Active menu item and sub-item are highlighted with a teal accent (#1A6B7B).

### Data Model Impact
- No new database tables required.
- Frontend: nav configuration object maps module → required role/permission; rendered conditionally.
Similar type of menu to build:

## 5.4  Global Search (Phase 3A)
Phase: Phase 3A — Foundations   |   Release: R3

### Overview
A global search text input positioned above the navigation menu.  On submit, the system searches all IMS objects the current user has access to, returning an exact-match section and a partial-match section on a dedicated results page.

### Functional Specification
- Search input box displayed at the top of the left sidebar, above the navigation menu.
- User types a search term and submits (Enter or search icon).
- Results page displays two sections: Exact Matches and Partial Matches.
- Searchable objects: Terminal serial numbers, Purchase Orders, Sales Orders, Rental Orders, Replacement Orders, Distribution Orders, Repair & Rework Orders, Return Orders, Products, Customers, Suppliers.
- Each result shows: object type label, identifier, key descriptors, and a clickable link to the object's detail page.
- Search respects location/region scoping from #14 — users only see results for objects they have access to.
- Backend: a single /api/search?q= endpoint performs cross-table search with LIKE / full-text match.
- From R3 Phase 3B onwards: Firmware records are also searchable (see Req #10).

### Data Model Impact
- No new tables.  Backend search endpoint queries existing tables with user-scoped filters.
- Consider adding search index on serial_number, po_number, so_number, ds_number, customer_name, product_code for performance.

## 5.5  Page & Size Alignment (Phase 3A)
Phase: Phase 3A — Foundations   |   Release: R3

### Overview
Audit and standardise all detail screens to ensure consistent full-width layout regardless of the navigation path that opened them.  PO, SO, RN, RP, DS, RR, and RE detail screens must render identically whether opened from their list view or from a hyperlink in a Terminal detail page.

### Functional Specification
- Audit all clickable hyperlinks to order detail screens from Terminal Detail page and other views.
- PO Detail, SO Detail, RN Detail, RP Detail, DS Detail, RR Detail, RE Detail — standardise container width, padding, and layout to match the screens when opened from their native list view.
- No new screens; existing screens are fixed for layout consistency.
- Regression test: open each order type via two paths and confirm identical rendering.

### Data Model Impact
- Frontend-only fix.  No database changes.

## 5.6  Product Master Update (Phase 3B)
Phase: Phase 3B — Master Data   |   Release: R3

### Overview
Extend the Product Master with country and region applicability, sell and rental pricing per country (with local currency), product alternative sequences, and enhanced BOM configuration including per-component quantities and assembly lead time.

### Functional Specification
- Country applicability: each product may have a list of active countries where it is available (many-to-many).
- Region applicability: each product may have sell price and rental price (per month) defined per region, stored in the local currency of that region.  Admin maintains via UI and Excel upload.
- Product alternatives: a product can have an ordered list of substitute products (AlternativeProductCode, Sequence).  Used by ATP engine (#8) when primary product is unavailable.
- BOM enhancement: when IsBOM = true, the BOM component configuration allows: component ProductCode (accessories and batteries only), Quantity per BOM unit, and a BOMAssemblyLeadtime field (value + unit: hours or days).
- All new fields available in Product Master UI (Admin) and Excel upload template.

### Data Model Impact
- New table product_countries: product_code, country_code, active
- New table product_pricing: id, product_code, region_code, country_code (nullable), sell_price, rental_price_month, currency, effective_date
- New table product_alternatives: id, product_code, alternative_product_code, sequence
- Update bom_components: add quantity (DECIMAL, default 1), assembly_leadtime_value (INTEGER), assembly_leadtime_unit (enum: hours/days)

## 5.7  Firmware Enhancement (Phase 3B)
Phase: Phase 3B — Master Data   |   Release: R3

### Overview
Introduce a Firmware master data table linking firmware versions to products.  Once a terminal reaches the Encryption Key Loaded state, the active firmware details are recorded against it and become searchable and filterable.

### Functional Specification
- New Firmware master data section in Admin: FirmwareName, Version, ReleaseNumber, ReleaseDate, ReleaseHour, KeyUsed (FK to encryption key master), FirmwareFile (binary upload).
- Each product has a LatestFirmwareID — Admin sets the current firmware version for that product.
- When a terminal transitions to the ENCRYPTION_KEY_LOADED state: system captures FirmwareName, Version, and ReleaseNumber and stores on the terminal record.
- Terminal Detail page header shows firmware details once the state is reached.
- All firmware fields (FirmwareName, Version, ReleaseNumber) are searchable via Global Search (#3) and filterable in the All Inventory view.

### Data Model Impact
- New table firmware: id, firmware_name, version, release_number, release_date, release_hour, key_used, file_path, created_at
- Update products: add latest_firmware_id (FK → firmware.id, nullable)
- Update terminals: add firmware_id (FK → firmware.id, nullable), firmware_applied_at

## 5.8  Network Design (Phase 3B — Prerequisite)
Phase: Phase 3B — Master Data (Prerequisite for ATP)   |   Release: R3

### Overview
Introduce Region and Country master data, followed by a graphical Network Design tool in Admin.  Admin models which locations supply to which, with flow types and optional constraints.  Network versions support baseline (operational) and simulation modes.  This is a prerequisite for ATP (#8) and supply simulations.

### Functional Specification
- Region master: EMEA, APAC, NA, SA as defaults; Admin can add further regions.  Each region has a name and code.
- Country master: all countries listed; Admin activates a country as a "serviced market".  Only activated countries can have locations and customers.
- Network Design screen (Admin → Network Design): a graphical canvas showing all active locations as nodes.
- Supply flows are drawn between nodes.  Nine flow types supported: (A) Supplier→Warehouse, (B) Warehouse→FSL, (C) Warehouse→Warehouse, (D) Warehouse→Repair Centre, (E) Repair Centre→Warehouse, (F) Repair Centre→FSL, (G) Warehouse→Customer, (H) FSL→Customer, (I) Customer→Warehouse.
- Each flow can optionally have constraints: applicable product(s), replenishment type(s), date range (from/to).  If no constraints set, the flow is unrestricted.
- Network versions: a baseline version is committed with a date and reference number.  Baselines apply to new transactions from that date onwards.  Simulation versions are kept separately and used for planning only; they can later be promoted to baseline.
- Admin commits a baseline via an explicit "Commit Baseline" action with confirmation.
- Only one active baseline at a time; historical baselines are retained read-only.

### Data Model Impact
- New table regions: id, region_code (UNIQUE), region_name, active
- New table countries: id, country_code (ISO 3166, UNIQUE), country_name, region_id (FK), serviced (boolean), activated_at
- New table network_versions: id, version_name, version_type (baseline/simulation), reference_number, effective_date, committed_at, committed_by, notes
- New table supply_flows: id, network_version_id (FK), from_location_id (FK), to_location_id (FK), flow_type (enum A-I), active
- New table flow_constraints: id, flow_id (FK), product_code (nullable), replenishment_type (nullable), valid_from (date, nullable), valid_to (date, nullable)
- Update locations: add region_id (FK → regions.id), country_id (FK → countries.id)
- Update customers: add country_id (FK → countries.id)

## 5.9  Available to Promise — ATP (Phase 3C)
Phase: Phase 3C — Intelligence (Requires Phases 3A + 3B)   |   Release: R3

### Overview
Full ATP logic applied at time of creating any outbound order (SO/RN/RP/DS).  The system searches for fulfilling inventory across the supply network in priority sequence, respecting region proximity, customer segment, product alternatives, and lead times.  ATP results are used to set estimated delivery dates and to peg specific serials to the order.

### Functional Specification
- Customer segment: Customer Master gains a SegmentID field.  New Segment master table: SegmentCode, SegmentName, Priority (integer, lower = higher priority).
- ATP triggered on order creation for each product line.
- ATP search sequence (per product, per quantity needed):
- Step 1: Identify customer's region.  Search nearest warehouse or FSL in that region with product in Available state.  Peg serials.  Calculate EDD = transit lead time from location.
- Step 2: If insufficient → look in staging states (QUARANTINE, STAGING, etc.) at same regional locations.  Calculate EDD = transit time + state-to-Available lead time.
- Step 3: If insufficient → look at Expected (incoming POs, not yet received) in regional warehouses.  Calculate EDD = transit time + PO arrival lead time.
- Step 4: If insufficient → look at on-order (PO in Issued state, no serials yet) in region.  Peg quantity to PO.
- Step 5: If still insufficient → repeat Steps 1–4 for other regions.
- Step 6: If still insufficient → offer alternative products (from Product Master #6) via dialog; user confirms substitution.
- Step 7: If no inventory at all → raise Alert: "Urgent inventory need: <<ProductCode>> in <<Region>>" to Supply Planner.
- ATP result written to order: FulfillingLocation, FulfillingQty, FulfillingSerials (for steps 1-3), EDD, PeggedToPO (for step 4).
- Pegged serials are visually flagged with a blue icon in inventory views.
- Alternative product substitution: user confirms via dialog; order line updated with substituted product code.
- ATP Admin Config: configurable ATP rules per region and per customer segment (weights, look-ahead horizons, allowed flow types).  Accessible via Admin → ATP Configuration tab.

### Data Model Impact
- New table customer_segments: id, segment_code, segment_name, priority (INTEGER)
- Update customers: add segment_id (FK → customer_segments.id, nullable)
- New table atp_rules: id, region_id (FK, nullable), segment_id (FK, nullable), rule_key, rule_value, description
- Update terminals: add pegged_to_order_id (FK → orders, nullable)
- Update order_lines: add fulfilling_location_id, edd (date), atp_status (enum: ATP_OK / ATP_PARTIAL / ATP_NONE)

## 5.10  BOM Process Enhancement (Phase 3C)
Phase: Phase 3C — Intelligence (Requires Phase 3B Product Master)   |   Release: R3

### Overview
Extend BOM handling for both inbound (multi-supplier component arrival) and outbound (component availability via ATP with auto-draft DS).  Builds directly on the ATP engine (#8) and enhanced Product Master (#6).

### Functional Specification
- Inbound BOM: BOM components can be purchased from different suppliers via separate POs.  System tracks individual component arrivals against the BOM product without requiring a single combined PO.
- Outbound BOM — ATP integration: when a BOM product is selected on an outbound order:
- ATP checks whether all BOM components are present in Available state at the same warehouse.
- If yes → add BOMAssemblyLeadtime to EDD.
- If no → for each missing component, run ATP logic across the supply network to find it.
- If found in another warehouse → auto-draft a Distribution Order for that component; add DS lead time to EDD.
- If not found anywhere → raise inventory shortage alert for that component to Supply Planner.
- Auto-drafted DS orders are listed on the outbound order detail page as "Component Transfer Orders" with status Draft; Supply Planner reviews and confirms.
- EDD is recalculated each time a component DS is drafted or a component arrives.

### Data Model Impact
- No new tables beyond Product Master (#6) and ATP (#8) changes.
- Update order_lines: add component_transfer_orders (array of DS IDs, nullable), bom_assembly_status (enum: COMPLETE / PARTIAL / PENDING)

## 5.11  Outbound Order Allocation (Phase 3C)
Phase: Phase 3C — Intelligence (Requires ATP #8)   |   Release: R3

### Overview
A dedicated Outbound Allocation screen lists all outbound orders (SO/RN/RP) grouped by customer and segment priority, showing ATP peg status.  Planners can manually reallocate pegged inventory from a lower-priority segment order to a higher-priority segment order, subject to a configurable look-back window.  Only unshipped orders are eligible for reallocation.

### Functional Specification
- New screen: Supply Planning → Outbound Allocation.
- Page displays two sections: "Allocated Orders" (ATP pegged) and "Non-Allocated Orders" (no ATP peg).
- Columns per order: Customer, Segment, Segment Priority, Product, Qty Ordered, Qty Allocated, Qty Shipped, Order Status, Order Date, EDD.
- Orders sorted by Segment Priority (highest priority first) within each section.
- Reallocation: planner selects a non-allocated (or lower-segment) order and triggers "Reallocate from…".  System shows eligible donor orders (same product, lower segment priority, not shipped, within look-back window).
- System Config parameter: ATP_REALLOCATION_LOOKBACK_DAYS (default 30) — only orders created within this many days are eligible as donors.
- Reallocation is only permitted on orders with status NOT Shipped (Draft, Issued, Allocated, In Picking).
- On reallocation confirm: peg moves from donor order to target order; EDD on donor order is cleared and re-calculated; alert sent to Supply Planner for both affected orders.

### Data Model Impact
- Terminal pegging columns already covered by ATP data model (#8).
- New field on outbound orders: allocation_source_order_id (FK → orders, nullable) — records which order donated pegged inventory.

## 5.12  Quality Hold State & PO Price Field (Phase 3D)
Phase: Phase 3D — Operations   |   Release: R3

### Overview
Introduce a new Quality Hold terminal state selectable at PO receiving alongside Quarantine.  A Quality Hold triggers a dedicated alert for the Warehouse User and Supplier.  Additionally, a Price Per Product field is added to PO lines to support cost tracking at purchase order level.

### Functional Specification
- PO Receiving dialog (Warehouse User, Inbound Specialist): lists all EXPECTING serials for the PO line.
- Per serial, user can select state: Quarantine (existing) or Quality Hold (new).
- "Select All" button applies chosen state to all serials in list.
- On Quality Hold state set: system raises a new alert rule QUALITY_HOLD_RAISED for Warehouse User and Supplier User roles, referencing the affected serial numbers and PO.
- Quality Hold state: terminals in this state are excluded from ATP searches until the state is resolved.
- PO Price field: new field PricePerProduct on PO line (DECIMAL), with currency selector.  Defaults to the product's UnitValue from Product Master; user can override.  Stored per PO line.

### Data Model Impact
- New terminal state: QUALITY_HOLD (added to terminal_states table)
- New alert rule: QUALITY_HOLD_RAISED (added to alert_rules table)
- Update po_lines: add price_per_product (DECIMAL), price_currency (VARCHAR)

## 5.13  Returns for RMA / Traceability & Investigation (Phase 3E)
Phase: Phase 3E — Portals & Document AI   |   Release: R3

### Overview
A new "Traceability" function under the Inventory menu allows users to investigate a specific terminal's complete history — from its original PO through every state transition to its current state.  From the traceability view, users can initiate an RMA, which generates an RMA reference number shared between the Return Order and the paired Repair & Rework Order.

### Functional Specification
- New page: Inventory → Traceability.
- User searches by serial number.  Results show: original PO reference, receipt date, all state history with timestamps and actors, firmware version at staging, all order references (SO, DS, RR, RE), current state and location.
- Initiate RMA button available from the traceability view (visible to RMA Manager and Supply Planner roles).
- On RMA initiation: system generates a unique RMA reference number in format RMAxxxxxx (sequential, padded to 6 digits; order numbering administered in Admin → Order Numbering).
- The RMA reference is applied to the Return Order (re_rma_reference field) and to the associated Repair & Rework Order (rr_rma_reference field) that is auto-created on RMA.
- RMA reference is displayed in Terminal Detail state history and on the traceability page.
- Restaging workflow: on RMA completion (Repair & Rework order closed as Repaired), terminal is routed to the restaging state sequence as configured in Terminal State Machine.

### Data Model Impact
- Update return_orders: add rma_reference (VARCHAR, nullable)
- Update repair_rework_orders: add rma_reference (VARCHAR, nullable)
- Update order_numbering: add RMA entry (prefix RMA, next_number, pad_length 6)
- Terminal Detail state history and Traceability page render rma_reference when present

## 5.14  Supplier Portal & AI Document Processing (Phase 3E)
Phase: Phase 3E — Portals & Document AI   |   Release: R3

### Overview
A dedicated Supplier portal scoped exclusively to the supplier's own data.  Key feature: AI-powered document processor for PO serial number import.  Supplier uploads a PDF, JPG, or XLS file; the system uses the Claude API to extract serial numbers and relevant fields, displays a confirmation page, and — on approval — loads the data into the PO as a named import batch.

### Functional Specification
- Supplier User logs into a dedicated portal view showing only their POs, shipments, and alerts.
- PO Import Serials — AI Document Processor:
- Supplier selects a PO and clicks "Import Serials from Document".
- Upload dialog accepts PDF, JPG, and XLS files.
- System sends file to Claude API (Anthropic) with instruction to extract: serial numbers, product codes, quantities, lot numbers, and shipment reference.
- System displays a Confirmation Page showing extracted data in a table.  Supplier can edit individual rows before confirming.
- On confirmation: data is loaded into the PO as a new import batch under the relevant PO line.
- Multiple import batches per PO line are supported.  Each batch requires a mandatory Shipment Reference (user-entered on the confirmation page).
- Shipment Reference marks the batch — visible in PO detail and on the terminal record.
- Batch is visible to other roles (Supply Planner, Warehouse User) from the moment of confirmation.
- Document Processor configuration (Admin → System Config): ANTHROPIC_API_KEY, AI_DOCUMENT_PROCESSOR_ENABLED (boolean).

### Data Model Impact
- New table serial_import_batches: id, po_id (FK), po_line_id (FK), shipment_reference (VARCHAR, NOT NULL), imported_at, imported_by_user_id, document_file_path, status (Pending/Confirmed/Rejected), confirmed_at
- Update terminals / serial import: add import_batch_id (FK → serial_import_batches.id, nullable)

## 5.15  Repair Shop Portal (Phase 3E)
Phase: Phase 3E — Portals & Document AI   |   Release: R3

### Overview
A dedicated portal for Repair Center Users, scoped to their assigned repair center.  Includes a document upload capability against repair orders for record storage.

### Functional Specification
- Repair Center User sees only RR orders assigned to their repair center.
- All existing Repair & Rework functionality available within the scoped view (receive, update status, enter costs, confirm return).
- Document upload: from RR order detail, Repair Center User can upload files (PDF, JPG, images) against the order.  Files are stored for reference; no AI processing.
- Uploaded documents are listed on the RR order detail page with file name, upload date, and uploader.

### Data Model Impact
- New table repair_documents: id, rr_order_id (FK), file_name, file_path, file_size, uploaded_at, uploaded_by_user_id

## 5.16  Warehouse Portal (Phase 3E)
Phase: Phase 3E — Portals & Document AI   |   Release: R3

### Overview
A dedicated filtered portal view for Warehouse Users, scoped to their assigned warehouse location.  Shows only inventory, orders, work orders, and alerts relevant to the warehouse.

### Functional Specification
- Warehouse User sees only inventory records with CurrentLocation = their assigned warehouse.
- Inbound POs: only POs with DestinationWarehouse = their warehouse.
- Outbound orders (SO/RN/RP/DS): only orders originating from or destined for their warehouse.
- Work Orders: only work orders at their warehouse.
- Alerts: only alerts where serial, order, or location is within their warehouse.
- No new functional features — this is a scoped view driven by the RBAC rules from Req #14.

### Data Model Impact
- No new tables.  All filtering enforced via user_locations join and location-scoped API queries from Req #14.

## 5.17  AI Assistant (Phase 3F)
Phase: Phase 3F — AI Assistant (Requires Phase 3E)   |   Release: R3

### Overview
An embedded AI assistant accessible from all IMS pages.  The assistant helps with navigation, explains data and alerts, and proactively surfaces insights — unacknowledged alerts, inventory anomalies, orders approaching SLA breach.  It is closely integrated with the Alerting Framework (R2 Phase 2K).

### Functional Specification
- Persistent AI assistant button (chat bubble icon) in the top navigation bar.
- Clicking opens a slide-in chat panel on the right side of the screen.
- Navigation help: user asks "How do I…" questions; assistant responds with step-by-step guidance relevant to their role.
- Data interpretation: user can ask about any alert, order, or inventory status; assistant provides plain-language explanation.
- Proactive surfacing: on opening the assistant, it auto-loads and summarises: count of unacknowledged alerts by severity, any inventory below safety stock threshold, any outbound orders with EDD past due.
- Alert integration: assistant can list, filter, and acknowledge alerts directly from the chat panel (calls existing Alerting API endpoints from R2 Phase 2K).
- Context awareness: assistant knows the current page, current user role, and can pull live data from the IMS API.
- Technology: Python FastAPI backend calls Anthropic Claude API with system context (user role, current page, relevant data summary).  Streaming responses for real-time typing effect.
- Admin config: AI_ASSISTANT_ENABLED (boolean) and ANTHROPIC_API_KEY managed in System Config (#7).  If disabled, the chat bubble is hidden.

### Data Model Impact
- New table ai_conversations: id, user_id (FK), session_id, started_at, ended_at
- New table ai_messages: id, conversation_id (FK), role (user/assistant), content, created_at
- New backend module: ai_assistant.py — manages prompt construction, context injection, Anthropic API calls
- Backend reads system_config for ANTHROPIC_API_KEY and AI_ASSISTANT_ENABLED

# 6.  RELEASE 3 — PROPOSED PHASING
The following phasing is proposed based on dependency order (master data before ATP, RBAC before portals) and delivery complexity.  Phase 3A should be delivered first to establish foundations.  Phases 3B and 3C can overlap once 3A is stable.

| Phase | Name | Requirements | Key Dependencies | Complexity |
|---|---|---|---|---|
| 3A | Foundations — Delivered | #14 User Roles & Rights / #7 System Config / #2 Menu Enhancement / #3 Global Search / #13 Page Alignment | None — foundational | High (#14) + Low (others) |
| 3B | Master Data — Delivered | #6 Product Master Update / #10 Firmware Enhancement / #5 Network Design (prerequisite) | Phase 3A (roles control access to Admin) | High (#5) + Medium (#6) + Low (#10) |
| 3C | Intelligence & Planning | #8 ATP (full regional + segment) / #9 BOM Process / #11 Outbound Allocation | Phase 3B (Network Design + Product Master required for ATP) | High (#8) + Medium (#9, #11) |
| 3D | Operations | #4 Quality Hold + PO Price | Phase 3A (roles for receiving dialog) | Low |
| 3E | Portals & Document AI | #1 RMA / Traceability / #15 Supplier Portal + AI Docs / #16 Repair Shop Portal / #17 Warehouse Portal | Phase 3A (RBAC required for portal scoping) | High (#15) + Medium (#1) + Low (#16, #17) |
| 3F | AI Assistant | #12 AI Assistant | Phase 3E (portals complete); Phase 2K Alerting (R2) for alert integration | Medium |


## 6.1  Phase Dependency Diagram
3A Foundations → 3B Master Data → 3C Intelligence  (all parallel to)  3D Operations → 3E Portals → 3F AI Assistant
3A is a prerequisite for all other phases.  3B is a prerequisite for 3C.  3D can be developed in parallel with 3B/3C once 3A is done.  3E and 3F follow after 3A (and 3D for RMA).

# 7.  NEW USER ROLES — R3

| Role | Type | Description | Key Permissions |
|---|---|---|---|
| Inbound Specialist | Internal (R3) | Manages PO receipt and quality inspection at warehouse. | PO receipt (Read/Write), Serial import (Read/Write), Quality Hold assignment, Warehouse tasks |
| Outbound Specialist | Internal (R3) | Manages outbound order fulfilment and serial allocation. | SO/RN/RP (create and issue), Serial allocation, Ship & Receive (Read/Write) |
| RMA Manager | Internal (R3) | Manages return merchandise authorisations and traceability investigations. | Returns (Read/Write), Repairs (Read/Write), Traceability, RMA initiation |
| Senior Management | Internal (R3) | Read-only visibility across all modules for reporting and oversight. | Inventory, all orders, analytics, supply/demand planning — Read only |


# 8.  R3 DATA MODEL — NEW TABLES SUMMARY

| Table | Purpose | Phase |
|---|---|---|
| user_roles | Multi-role assignment per user (many-to-many) | 3A |
| user_locations | Location scoping per user (many-to-many) | 3A |
| user_regions | Region scoping per user (many-to-many) | 3A |
| system_config | Centralised configurable parameters | 3A |
| customer_segments | Segment master: code, name, priority | 3C (ATP) |
| regions | Region master: EMEA, APAC, NA, SA | 3B |
| countries | Country master with serviced flag | 3B |
| network_versions | Baseline and simulation network versions | 3B |
| supply_flows | Directional supply flow between locations | 3B |
| flow_constraints | Product / replenishment / date constraints per flow | 3B |
| product_countries | Product-to-country applicability (many-to-many) | 3B |
| product_pricing | Sell price + rental price per product per region/country | 3B |
| product_alternatives | Alternative product substitutions with sequence | 3B |
| firmware | Firmware master: name, version, file, key | 3B |
| atp_rules | ATP configuration per region and/or segment | 3C |
| serial_import_batches | Supplier import batches with shipment reference | 3E |
| repair_documents | Document uploads against RR orders | 3E |
| ai_conversations | AI assistant conversation sessions | 3F |
| ai_messages | Individual messages in AI assistant conversations | 3F |

Existing tables with new columns: customers (+segment_id, +country_id), products (+latest_firmware_id), terminals (+firmware_id, +firmware_applied_at, +pegged_to_order_id), po_lines (+price_per_product, +price_currency), return_orders (+rma_reference), repair_rework_orders (+rma_reference), order_lines (+fulfilling_location_id, +edd, +atp_status, +bom_assembly_status).

# 9.  NON-FUNCTIONAL REQUIREMENTS — R3 ADDITIONS

| Category | Requirement |
|---|---|
| AI API | Claude API calls must be asynchronous; frontend shows loading indicator.  Errors must be caught and displayed gracefully with fallback message. |
| AI Document Processing | Document extraction must complete within 15 seconds for files up to 10 MB.  Confirmation page shown before any data is committed. |
| Network Design | Canvas renders up to 50 locations and 200 supply flows without degradation. |
| ATP | ATP calculation must complete within 3 seconds per order line for a network of up to 20 locations. |
| Security | AI API key stored encrypted in database (system_config).  Never returned in API responses.  Document uploads virus-scanned before processing. |
| Data Scoping | All API endpoints enforce location/region scoping server-side.  Client-side filtering is decorative only. |
| Backward Compatibility | R1 and R2 data is fully preserved.  All existing API endpoints continue to function unchanged. |

— END OF DOCUMENT —
IMS PRD v3.0 Consolidated  |  June 2026  |  Classification: CONFIDENTIAL

# APPENDIX A — ROLES & RIGHTS MATRIX
Access rights per role across all IMS functional areas. R/W = Read/Write, R = Read only, — = No access.  New R3 roles shown in the last four columns.

|  | Internal |  |  | External |  |  | Internal |  |  |  |
|---|---|---|---|---|---|---|---|---|---|---|
| Functional Area / Feature | Admin | Supply Planner | Demand Planner | Warehouse User | Supplier User | Repair Center User | Inbound Specialist (R3) | Outbound Specialist (R3) | RMA Manager (R3) | Senior Management (R3) |
| Admin — Master Data Core (Locations, Suppliers, Products, Customers, Users & Roles, Terminal States, Calendars, Claim Types, Alerts) + System Config | R/W | R | — | — | — | — | — | — | — | — |
| Admin — Master Data Supply Chain (Cost Master, FX Rates, ATP Configuration) | R/W | R/W | R | — | — | — | — | — | — | — |
| Admin — Upload | R/W | R/W | — | — | — | — | — | — | — | — |
| Network Design (R3) | R/W | R/W | R | — | — | — | — | — | — | — |
| Inventory — Terminal Serial Numbers | R/W | R/W | R/W | R | R | R | R | R | R | R |
| Purchase Orders — Create, Issue & Cancel | R/W | R/W | R | R | R | R | R/W | R | R | R |
| Purchase Orders — Import Serials | R/W | R/W | R | R | R/W | R/W | R/W | R | R | R |
| Purchase Orders — Receive | R/W | R/W | R | R/W | R/W | R/W | R/W | R | R/W | R |
| Outbound Orders (SO/RN/RP) — Create, Issue & Cancel | R/W | R/W | R | R | — | — | — | R/W | — | — |
| Outbound Orders (SO/RN/RP) — Allocate Serials | R/W | R/W | R | R/W | — | — | — | R/W | — | — |
| Outbound Orders (SO/RN/RP) — Ship & Receive | R/W | R/W | R | R/W | — | — | — | R/W | — | — |
| Distribution Orders — Create, Issue & Cancel | R/W | R/W | R | R | — | — | R/W | R/W | — | — |
| Distribution Orders — Allocate Serials | R/W | R/W | R | R/W | — | — | R/W | R/W | — | — |
| Distribution Orders — Ship & Receive | R/W | R/W | R | R/W | — | — | R/W | R/W | — | — |
| Warehouse Tasks | R/W | R | R | R/W | — | — | — | — | — | — |
| Warehouse Tasks — Work Orders | R/W | R | R | R/W | — | — | — | — | — | — |
| Returns | R/W | R | R | R/W | — | — | R/W | R/W | R/W | R |
| Repairs | R/W | R | R | R/W | R/W | R/W | R/W | R/W | R/W | R |
| Repairs — Receive at Repair Centre, Mark In Repair, Complete, Mark Returned | R/W | R | R | R | R/W | R/W | R/W | R/W | R/W | R |
| Demand Signals | R/W | R/W | R/W | — | — | — | — | R | — | R |
| Demand Forecast (Long Term) | R/W | R/W | R/W | — | — | — | — | R | — | R |
| Forecast Inventory View | R/W | R/W | R/W | — | — | — | — | R | — | R |
| Supply Stock Targets | R/W | R/W | R | — | — | — | — | — | — | R |
| Supply — Replenishment Planner | R/W | R/W | R | — | — | — | — | — | — | R |
| Purchase Predictions | R/W | R/W | R | — | — | — | — | — | — | R |
| Scenario Network Simulations (R3) | R/W | R/W | R | — | — | — | — | — | — | R |
| Analytics | R/W | R/W | R | R | — | — | — | — | — | R |

Legend:  R/W = Read / Write   R = Read only   — = No access
Note 1: Each user must be assigned either a Location (for Warehouse User, Repair Centre User) or a Region (for internal roles). Multiple locations and regions are supported.
Note 2: Supplier Users are automatically scoped to their linked Supplier entity. Only one Supplier entity per Supplier User.
Note 3: Location and region scoping means users only see data for their assigned locations/regions — e.g., a Warehouse 1 user does not see Warehouse 2 inventory or orders.
Note 4: For all new R3 features, role access rights for new menu items to be confirmed during sprint planning.

# APPENDIX B — AGENTIC IMS: IMS_PROCUREMENT AGENT DESIGN
Agent Name: IMS_Procurement
Purpose: Monitor purchase requisitions and autonomously generate purchase orders to the right supplier in time.
Trigger: Scheduled, 2x daily at 9AM and 3PM CET. No user input required.
Tools

| Tool | API Call |
|---|---|
| get_purchase_predictions() | GET /purchase-predictions |
| create_purchase_order(product, supplier, qty) | POST /purchase-order |
| update_pr_status(pr_id, status) | PATCH /purchase-requisitions/{id} |
| get_supplier(product_id) | GET /suppliers |
| log_action(message, po_id, pr_id) | POST /logs |
| send_email(to, subject, body) | external / SMTP |

ReAct Loop
THINK: Fetch all purchase predictions
ACT:   call get_purchase_predictions()
OBSERVE: [list of predictions with urgency flags]
THINK: Filter for "Urgent" items only
ACT:   filter in memory
For each Urgent item:
THINK: Is supplier assigned?
→ No:  ACT: call get_supplier(product_id)
→ Yes: proceed
THINK: Calculate qty = shortage + buffer
THINK: Is qty > 100 or value > 5000 or data missing?
→ Yes: PAUSE → raise human-in-the-loop dialog
→ No:  ACT: call create_purchase_order()
ACT:   call update_pr_status(pr_id, "fulfilled")
ACT:   call log_action(thinking + result, po_id, pr_id)
THINK: Summarize all actions taken
ACT:   call send_email(supply_planner, summary)
Human-in-the-Loop Triggers
Shortage qty > 100
Order value > 5,000
No supplier found after lookup
Order date ambiguous
Logging
All agent thinking and actions are logged via log_action(), loosely attached to both the created PO and the originating PR. This provides a full audit trail of autonomous decisions for Supply Planner review.

## IMS_InventoryShortage Agent
Agent Name: IMS_InventoryShortage
Purpose: Monitor inventory levels per product at each warehouse and FSL using the Forecast Inventory View. When a shortage is detected, autonomously search for alternative inventory across the supply network and issue draft replenishment orders or reservations.
Trigger: Scheduled, 2x daily at 9AM and 3PM CET. No user input required.
Tools

| Tool | API Call |
|---|---|
| get_forecast_inventory(location, product) | GET /forecast-inventory |
| search_network_inventory(product, exclude_location) | GET /inventory?product=&location= |
| create_distribution_order(product, from, to, qty) | POST /distribution-orders (status: Draft) |
| create_purchase_requisition(product, location, qty) | POST /purchase-requisitions |
| create_repair_reservation(product, location, rr_id, qty) | POST /repair-reservations |
| create_recommendation(type, product, location, detail) | POST /agent-recommendations |
| log_action(message, order_id, ref_id) | POST /logs |
| send_email(to, subject, body) | external / SMTP |

ReAct Loop
THINK: Fetch forecast inventory for all active locations and products
ACT:   call get_forecast_inventory(location=ALL, product=ALL)
OBSERVE: [list of forecast exceptions with horizon and shortage qty]
THINK: Classify exceptions by urgency horizon
→ <= 1 month:  URGENT — act now
> 1 month: NOT urgent — flag for future PR planning only
For each URGENT exception:
THINK: Search for inventory across network in priority order
1. Other FSLs in same region
2. Regional warehouse(s)
3. Repair shops (inventory received but not yet available)
4. Other regions (warehouses + FSLs)
5. Suppliers (raise PR if no internal source found)
THINK: Is qty > 100 or value > 5,000 or data missing?
→ Yes: PAUSE → raise human-in-the-loop dialog
→ No:  ACT: create draft DO / PR / repair reservation as appropriate
ACT:   call create_recommendation(type, product, location, detail)
ACT:   call log_action(thinking + result, order_id, ref_id)
THINK: Summarize all actions and recommendations
ACT:   call send_email(supply_planner, summary)
Human-in-the-Loop Triggers
Shortage qty > 100
Order value > 5,000
Source location ambiguous or no inventory found anywhere
Key date or quantity data missing
New Menu: Agent Recommendations
A new menu item — Supply > Agent Recommendations — lists all recommendations created by this agent, grouped by location and product. Each row shows: recommendation type (DO / PR / Repair Reservation), product, source location, destination location, qty, urgency horizon, status (Pending / Actioned / Dismissed), and a link to the drafted order. Supply Planner can review, confirm, or dismiss each recommendation from this screen.
Logging
All agent thinking and actions are logged via log_action(), loosely attached to the created DO, PR, or repair reservation and to the originating forecast exception. Full audit trail available for Supply Planner review.

## IMS_CustomerPriorityManager Agent
Agent Name: IMS_CustomerPriorityManager
Purpose: Optimise inventory pegging to customer orders on top of the ATP engine (Phase 3C). Continuously monitors the Outbound Allocation space, evaluates customer priority, criticality, and special remarks, and autonomously reviews or changes pegging decisions to best serve the most important customers within their Desired EDD.
Trigger: Online — event-driven. Agent monitors the Supply Planning → Outbound Allocation screen continuously. Activates on any new outbound order, allocation change, or pegging status update. No scheduled run; reacts in real time as orders are entered or modified.
New Data Field: A new field desired_edd (Desired Estimated Delivery Date — customer’s requested delivery date) is added to all outbound orders: SO, RN, and RP. This field drives the agent’s reallocation feasibility check.
Tools

| Tool | API Call |
|---|---|
| get_allocation_status() | GET /outbound-allocation |
| get_customer_priority(customer_id) | GET /customers/{id} (segment, priority, remarks) |
| get_inbound_pipeline(product, location) | GET /purchase-orders + /repair-orders (status=Issued) |
| search_network_inventory(product, region) | GET /inventory (Available + In Transit, all locations) |
| reallocate_pegging(from_order_id, to_order_id, serial_ids) | POST /pegging/reallocate |
| create_recommendation(type, detail) | POST /agent-recommendations |
| log_action(message, order_id, pegging_id) | POST /logs |
| send_email(to, subject, body) | external / SMTP |

ReAct Loop
THINK: Event received — new order entered or allocation changed
ACT:   call get_allocation_status() — fetch all allocated + non-allocated outbound orders
OBSERVE: [orders with pegging status, EDD, desired_edd, customer segment + priority]
THINK: Identify priority conflicts — non-allocated high-priority orders, or EDD mismatches
For each conflict:
THINK: Fetch customer priority, segment, criticality, special remarks
ACT:   call get_customer_priority(customer_id)
THINK: Search for inventory that can fulfil order within desired_edd
1. Available inventory at same warehouse / FSL
2. Inventory pegged to a lower-priority order (reallocation candidate)
3. Incoming inventory (PO / Repair order) arriving before desired_edd
4. Inventory at other warehouses / FSLs where leadtime fits desired_edd
THINK: Is reallocation safe? Is qty > 100, value > 5,000, or donor order equally critical?
→ Yes: PAUSE → raise human-in-the-loop dialog
→ No:  ACT: call reallocate_pegging(from_order_id, to_order_id, serial_ids)
ACT:   call create_recommendation(type=REALLOCATION, detail)
ACT:   call log_action(thinking + result, order_id, pegging_id)
ACT:   call send_email(supply_planner + warehouse_user, summary of reallocation decisions)
Human-in-the-Loop Triggers
Reallocation qty > 100
Order value > 5,000
Donor order is equally critical or has same customer segment priority
No feasible inventory found within desired_edd from any location
Key customer data or desired_edd missing
Data Model Impact
Update sales_orders, rental_orders, replacement_orders: add desired_edd (DATE, nullable) — customer’s requested delivery date. Visible and editable on order detail screen. New table agent_recommendations already introduced by IMS_InventoryShortage; extended here with type=REALLOCATION rows.
Logging
All agent thinking and reallocation decisions are logged via log_action(), loosely attached to both the reallocated pegging record and the originating outbound order. Full audit trail available to Supply Planner and Warehouse User via the Agent Recommendations screen.
