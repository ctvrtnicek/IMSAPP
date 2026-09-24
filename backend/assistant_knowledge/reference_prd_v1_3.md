<!-- Reference only: PRD v1.3 (R1 + R2 functional specification, converted from SPECS).
     Where it differs from process_guide.md, the process guide describes the real system. -->

INVENTORY MANAGEMENT SYSTEM
(Terminal Tracking Application)
Product Requirements Document

| Version | 1.3 — Consolidated (R1 complete · R2 full scope) |
|---|---|
| Date | May 2026 |
| Author | Jakub Ctvrtnicek |
| Customer | Terminal Distributor |
| App Name | Inventory Management System (IMS) |
| Classification | Confidential |
| Local URL | http://localhost:3000 |
| Folder | C:\\IMSAPP |
| Previous | v1.2 (R2 scope + R1 patches) |
| Status | R1 complete · R2 in planning |


# 1. VERSION HISTORY

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | May 2026 | Jakub Ctvrtnicek | Initial PRD draft — R1 scope defined |
| v1.1 | May 2026 | Jakub Ctvrtnicek | Supplier role, Business Objects, Views, Transit Time Master, Exchange Rate, Order Numbering, state history 1:N, return/repair updates, mass upload expansion |
| v1.2 | May 2026 | Jakub Ctvrtnicek | R1 complete. R1 patch items. R2 scope with inventory enhancements, cost calculation engine, cost KPI dashboards. API integration deferred. |
| v1.3 | May 2026 | Jakub Ctvrtnicek | Consolidated document. Serial number fields enhanced from Terminals_receiving-Sample. Data model updated from 7 customer sample files. Dispatch/Repair & Rework replaces Repair Orders. Orders split into 3 tabs. Terminal Detail full screen. Business Calendar master data. State lead time + sequence. R2 planning features fully specified. |


# 2. EXECUTIVE SUMMARY
The Inventory Management System (IMS) is a purpose-built standalone web application for Terminal Distributor — a global payment terminal distributor managing serialised payment devices across a worldwide warehouse network. The application is the master system of record for terminal serial number tracking, inventory counts, order management, and cost calculation.
Release 1 is complete and running locally at http://localhost:3000 in C:\IMSAPP. This document is the consolidated v1.3 PRD covering: the full R1 feature set as delivered, R1 patch items to be applied, and the complete R2 roadmap including inventory enhancements, cost calculation, planning (demand, supply, repositioning), purchase prediction, alerting, and API integration.
Technology: React + Vite frontend, e2open teal green (#1A6B7B) navbar, Python FastAPI backend, SQLite (local) → PostgreSQL (server), Tailwind CSS, JWT auth.

# 3. BACKGROUND & CONTEXT

## 3.1 Customer Profile
Terminal Distributor is a global distributor of payment terminals operating a network of warehouses and FSLs across Europe, North America, Asia-Pacific, and South America. Portfolio: ~486 SKUs including serialised payment terminals, serialised accessories (pin pads, contactless readers), and non-serialised accessories (cables, SIM cards, receipt rolls, batteries — referred to in IMS as Accessories).

## 3.2 Warehouse & FSL Network

| Code | Name | Country | Region | Type |
|---|---|---|---|---|
| Oostrum | Oostrum Warehouse | Netherlands | Europe | Warehouse |
| DHLAU | DHL Australia | Australia | Asia-Pacific | Warehouse |
| Memphis | Memphis Warehouse | USA | North America | Warehouse |
| Sacramento | Sacramento Warehouse | USA | North America | Warehouse |
| Sorocaba | Sorocaba Warehouse | Brazil | South America | Warehouse |
| Changi | Changi Singapore | Singapore | Asia-Pacific | Warehouse |
| FSLUK | FSL United Kingdom | UK | UK | FSL |
| FSLMX | FSL Mexico | Mexico | Mexico | FSL |
| FSLSG | FSL Singapore | Singapore | Singapore | FSL |
| FSLJP | FSL Japan | Japan | Japan | FSL |
| FSLbrazil | FSL Brazil | Brazil | South America | FSL |


## 3.3 Known Suppliers

| Supplier Code | Name | Country |
|---|---|---|
| Castles | Castles | Italy |
| CastlesBrazil | Castles Brazil | Brazil |
| CastlesUS | Castles US | USA |
| VerifoneEU | Verifone EU | Poland |
| VerifoneUS | Verifone US | USA |
| Datecs | Datecs | Bulgaria |
| HAVIS | HAVIS | USA |
| VadeloBV | Vadelo BV | Netherlands |
| KPNBV | KPN BV | Netherlands |
| BradyBV | Brady BV | Netherlands |
| AvendesoraTL | Avendesora Trading Ltd. | Ireland |


# 4. OBJECTIVES
1. Serial-Level Whereabouts: Monitor location and status of every terminal by serial number at all times.
2. Inventory Overview: Real-time counts by product and location across all states.
3. Cost Tracking: Activity costs per terminal per state transition; accumulated cost normalised to reporting currency.
4. Cost Analytics: KPI dashboards for accumulated cost per terminal, cost by location, cost by product family, repair cost analysis.
5. Inventory Planning (R2): Identify locations with missing or excess terminals; support repositioning.
6. Collaboration: Multiple personas collaborate on a single record.
7. Repositioning Planning (R2): Plan and execute inter-warehouse terminal transfers.
8. KPIs & Analytics: Dwell times, repair times, transit times, order fulfilment rate, return rates, cost metrics.
9. Return & Repair Management: Full return, repair, and rework lifecycle including Scrap/End of Lifecycle.
10. Available-to-Promise: Instant ATP confirmation on outbound orders using inventory + transit + assembly times.
11. Purchase Prediction (R2): Forecast new purchase orders from suppliers.
12. Master Data Management: All reference data managed by Admin with Excel upload.

# 5. SCOPE

## 5.1 Release 1 — Delivered

| Module | Status |
|---|---|
| Master Data (Products/BOM, Suppliers, Locations, Transit Times, Assembly Times, Business Calendars, Customers, States, Activity Costs, Exchange Rates, Order Numbering) | Delivered |
| Serial Number Tracking + Configurable State Machine + 1:N State History | Delivered |
| Accessories Inventory (count per location, Received/Available) | Delivered |
| Inbound Flow (PO Header+Lines, Serial Import, Receipt Confirmation) | Delivered |
| Sales Orders (SO), Rental Orders (RN), Replacement Orders (RP) | Delivered |
| Distribution Orders (DS) — inter-warehouse transfers | Delivered |
| Repair & Rework Orders (RR) — dispatch to repair/rework shop, inbound return | Delivered |
| Return Orders (RE) with Scrap and Defective outcomes | Delivered |
| Mass Upload (PO receipt, state updates, shipment confirmation) | Delivered |
| Analytics & KPI Dashboard | Delivered |
| User Roles & Auth (Admin, Supply Planner, Warehouse User, Repair Centre, Supplier) | Delivered |
| Terminal Detail — full screen with state history, Activity Description, Order hyperlinks | Delivered |
| API Integration Module (stub/scaffold) | Delivered — not activated |


## 5.2 R1 Patch Items

| ID | Change | Description |
|---|---|---|
| P-01 | App renamed | Application title updated to Inventory Management System (IMS) |
| P-02 | e2open green navbar | Navbar colour: e2open teal green #1A6B7B |
| P-03 | Nav: Warehouse Tasks | Warehouse + Upload merged into Warehouse Tasks |
| P-04 | Nav: Admin | Master Data + Admin merged into Admin |
| P-05 | In Transit label | Expecting renamed to In Transit in UI |
| P-06 | Accessories label | Non-Serialised Inventory renamed to Accessories in UI |


## 5.3 Release 2 — Full Scope

| Module | Type | Description |
|---|---|---|
| Inventory: Latest Date & Location column | NEW | All Terminals view gains Latest Date and Latest Location columns |
| In Transit view: full transit states | NEW | In Transit shows EXPECTING + TRANSIT_TO_COMPANY + TRANSIT_TO_WAREHOUSE |
| Column filtering | NEW | All inventory and order list views support column-level filtering |
| PO: Received Date field | NEW | PO Header and Line gain Received Date field |
| Cost Calculation Engine | NEW | Activity costs applied per state transition; accumulated cost maintained per serial |
| Cost KPI Dashboards | NEW | 4 cost analytics views: Per Serial, By Location, By Product Family, Repair Analysis |
| Demand Planning | ORIGINAL | Demand Planner role; demand signal management; forward demand forecasting |
| Supply Planning | ORIGINAL | Safety stock targets; replenishment planning; gap/overflow identification |
| Repositioning Planning | ORIGINAL | Plan and execute inter-warehouse transfers based on demand vs. supply |
| Purchase Prediction | ORIGINAL | Forecast new POs from demand signals + supplier lead times |
| Work Orders | ORIGINAL | Auto-generated warehouse assembly instructions for multi-location BOM fulfilment |
| Claims Management | ORIGINAL | Claim types (missing, damaged) against supplier or carrier on PO receipt discrepancy |
| Alerting Framework | ORIGINAL | Configurable event-driven alerts: rental expiry, return receipt, low stock, state dwell exceeded |
| API Integration | ORIGINAL — TBD | Live GET/POST with external Logistics API. Spec addendum required. |
| Demand Planner Role | ORIGINAL | Full demand planning permissions and dedicated views |

Note: Out of scope for both releases: ERP integration, carrier booking, invoice generation, financial reporting.

# 6. USER PERSONAS & ROLES

| Role | Description | Key Permissions | Release |
|---|---|---|---|
| Admin | System administrator. Manages all master data, users, states, numbering, calendars. | Full access: all master data CRUD, user management, state config, cost master, exchange rates, order numbering, business calendars | R1 |
| Supply Planner | Creates outbound orders, monitors inventory and order status, reviews ATP. | Create/edit all order types; view inventory and cost dashboards; view PO status | R1 |
| Warehouse User | Receives inbound shipments, confirms state changes, performs mass uploads. | Confirm PO receipt; mass upload state changes; confirm shipment; Warehouse Tasks module | R1 |
| Repair Centre | Manages terminals dispatched for repair or rework. | View repair queue; confirm receipt; update repair status; enter actual costs; confirm send-back | R1 |
| Supplier | External vendor. Can upload serial number files for their POs. | Upload serial files for own POs; view own PO status only | R1 |
| Demand Planner | Manages demand signals and forecasting data. | Create/edit demand signals; view planning dashboard | R2 |


# 7. BUSINESS OBJECTS
Core data entities in the IMS. All serialised product tracking is at serial number level with an immutable 1:N state history.
Terminal (Serial Number)
Physical serialised payment device with attributes: SerialNumber, SupplierID, ProductCode, LotNumber, TerminalType, CurrentState, CurrentLocation, StockType, SecuritySeal, KeyLoaded, WiFiMAC, BluetoothMAC, EthernetMAC, IMEI1, IMEI2, ICCID, EID, KeyID, AccumulatedCost, Active. Release: R1.
State History Record
Immutable audit log per serial. 1:N per terminal with fields: SerialNumber, StateCode, Location, DateTime(UTC+TZ), ActorType, ActorUser, ActivityDescription, OrderReference, ActivityCost, ActivityCostCurrency, ReportingCurrencyEquivalent, ExchangeRateApplied, Notes. Release: R1.
Accessories Inventory
Non-serialised accessory count per location: ProductCode, Location, State(Received/Available), Quantity. Release: R1.
Product
SKU — standalone or BOM kit: ProductCode, Description, Type, Category, Serialised, IsBOM, Components, Suppliers, RepairCentres, Countries, UnitValue, VendorKeyloaded, InterchangeableProducts, HSCode, Active. Release: R1.
Supplier, Location, Business Calendar, Transit Time Lane, Assembly Time, Customer, Terminal State, Activity Cost, Exchange Rate
See Section 9 (Functional Requirements — Master Data) for complete field definitions. Release: R1.
Purchase Order, Sales Order, Distribution Order, Repair & Rework Order, Return Order
See Section 12 (Functional Requirements — Outbound Orders) for complete field definitions. Release: R1.
Work Order, Claim
See Section 14 (Functional Requirements — R2 Features) for definitions. Release: R2.

# 8. APPLICATION VIEWS

## 8.1 Navigation Structure (post R1 patch)

| Nav Icon | Module | Contains | Notes |
|---|---|---|---|
| Dashboard | Dashboard | Home KPI, alerts, quick links | - |
| Inventory | Inventory | All Terminals, By State, By Location, By Product, In Transit, Accessories, Terminal Detail, ATP Query | Expecting→In Transit; Non-Serialised→Accessories |
| Sales Orders | Sales Orders | SO/RN/RP list and detail views | Split from single Orders tab |
| Distribution Orders | Distribution Orders | DS list and detail | Split from single Orders tab |
| Repair & Rework | Repair & Rework | RR outbound dispatch and inbound return, list and detail | Replaces Repair Orders tab |
| Purchase Orders | Purchase Orders | PO list and detail | - |
| Upload | Upload | Upload Centre with templates for all entity types | Renamed from Excel Mass Upload |
| Analytics | Analytics | KPI Dashboard, Cost Dashboards (R2) | - |
| Admin | Admin | All master data screens, users, API config | Merged from Master Data + Admin |


## 8.2 Key Views Summary
Inventory: All Terminals (searchable, filterable), By State (grouped), By Location (warehouse counts), By Product (per SKU), In Transit (carriers, ETAs), Accessories (non-serialised), Terminal Detail (full screen), ATP Query.
Orders: Sales Orders (SO/RN/RP list), Distribution Orders (DS list), Repair & Rework (combined outbound/inbound), Purchase Orders (PO list).
Analytics: KPI Dashboard (dwell times, fulfillment rates), Cost Per Serial, Cost By Location, Cost By Product Family, Repair Cost Analysis.
Admin: Products, Suppliers, Locations, Business Calendar, Transit Time Lanes, Assembly Times, Customers, Terminal States, Activity Costs, Exchange Rates, Order Numbering, Users & Roles, API Configuration.

# 9. FUNCTIONAL REQUIREMENTS — MASTER DATA

## 9.1 Product Master & BOM
Fields: ProductCode, Description, ProductType (Terminal/Accessory/Battery), Category, Serialised, VendorKeyloaded, IsBOM, UnitValue, Regions, InterchangeableProducts, HSCode, BOMComponents, Suppliers, AuthorisedRepairCentres, ApplicableCountries, Active. Admin can upload via Excel and add/remove BOM components in UI.

## 9.2-9.11 Master Data Entities
Supplier Master: Code, Name, Country, City, ContactEmail, ContactPhone, Products, BusinessCalendar, Active.
Location Master: Code, Name, LocationType (configurable), Country, City, ReportingCurrency, BusinessCalendar, Active.
Business Calendar: EntityType, EntityID, Timezone (IANA), WorkingDays, WorkHoursStart/End, PublicHolidays. Default: Mon-Fri 08:00-17:00 UTC.
Transit Time Master: FromLocation, ToLocation, TransportMode (Air/Sea/Road), LeadTimeDays. Global fallback: 14 days.
Assembly Time Master: Location, DurationDays (default 2).
Customer Master: CustomerID, DUNSNumber, Name, CustomerType, Country, StateRegion, CreditRating, DeliveryAddress, ContactEmail, ContactPhone, Active.
Terminal State Configuration: StateCode, DisplayName, WarehouseType, SequenceNumber, ValidLocationTypes, ExpectedDuration, ValidPredecessorStates, ActingRole, Active. 19 default states from EXPECTING to SCRAP_DESTROYED.
Activity Cost Master: Location, StateCode, Product (optional), Amount, Currency.
Exchange Rate Master: FromCurrency, ToCurrency, Rate, EffectiveDate.
Order Numbering: PO (PO000001), SO (SO000001), RN (RN000001), RP (RP000001), DS (DS000001), RR (RR000001), RE (RE000001).

# 10. FUNCTIONAL REQUIREMENTS — INVENTORY TRACKING

## 10.1 Serial Number (Terminal) Record
Each serialised terminal has current state record plus immutable 1:N state history. Enhanced fields from Terminals_receiving-Sample.xls: SerialNumber (unique), SupplierID, ProductCode, LotNumber, TerminalType (full model string), CurrentState, CurrentLocation, StockType (Live/Refurbished/Returned/Test), SecuritySeal, KeyLoaded (derived from state), WiFiMAC, BluetoothMAC, EthernetMAC, IMEI1, IMEI2, ICCID (SIM identifier), EID (eSIM identifier), KeyID (encryption key), POReference, OrderReference, AccumulatedCost (reporting currency), Active (false = SCRAP/DESTROYED).
State History (immutable, 1:N per serial): StateCode, Location, DateTime_UTC, Timezone, ActorType (user/api/system), ActorUserID, ActivityDescription, OrderReference, ActivityCost, ActivityCostCurrency, ReportingCurrencyEquivalent, ExchangeRateApplied, Notes.

## 10.2 Accessories Inventory
Product (non-serialised), Location, State (Received/Available), Quantity, UpdatedAt.

# 11. FUNCTIONAL REQUIREMENTS — INBOUND FLOW

## 11.1 Purchase Order Management
PO Header: PONumber, ExternalReference, Supplier, DestinationWarehouse, OrderDate, ExpectedArrivalDate, PartialOrder (boolean), Environment (Live/Test), Status, Notes. PO Status flow: Draft → Issued → Expected → Partially Received → Fully Received → Closed/Cancelled. PO Line: LineNumber, ProductCode, QtyOrdered, QtyExpected (serials declared), QtyReceived (confirmed), ReceivedDate.

## 11.2 Serial Number Import — Terminals_receiving-Sample Format
Multi-sheet XLS file. Sheet name: serial range. Row 0-1: Product header (PN, Type, Total Qty). Row 3: Column headers. Rows 4+: Data rows. On import: user selects PO or matches from file's PO# column. System creates serial record per row with state = EXPECTING. Fields mapped from columns. Uniqueness check: SerialNumber + Supplier must be unique. PO status updates to Expected. Upload personas: Supplier (own POs only), Supply Planner, Warehouse User.

## 11.3 Warehouse Receipt Confirmation
PO Detail view shows: Qty Ordered | Qty Expected | Qty Received | Received Date. Receipt flow: Warehouse User selects serials, confirms receipt → EXPECTING → QUARANTINE, Received Date populated, PO status updates.

# 12. FUNCTIONAL REQUIREMENTS — OUTBOUND ORDERS

## 12.1 Sales Orders (SO/RN/RP)
Order types: Sales (SO), Rental (RN), Replacement (RP). Fields: OrderType, OrderState, MerchantReference, Stock, Location, CompanyAccount, Environment, InvoicedFrom/To, OrderLines, ShipTo, ShippedLines, Tracking. Rental additional: RentalPeriodMonths (default 12), RentalFee, ExpectedReturnDate. Replacement additional: LinkedReturnOrderID. Workflow: Draft → Issued → Allocated → In Picking → Shipped → Delivered → Closed. ATP calculated; red warning if infeasible.

## 12.2 Distribution Orders (DS)
Inter-warehouse transfers. Fields: DistributionReference, OriginLocation, DestinationLocation, Environment, DistLines (product, qty, stock, productState), ShipFrom/To, Tracking, ShippedLines, InboundRecord, ReceivedRecord, ShipmentDates.

## 12.3 Repair & Rework (RR)
Replaces Repair Orders. Types: Repair | Rework. Outbound: Reference, Location, Type, Reason, Environment, ShipTo, Tracking, ShippedLines. Inbound: same header fields plus ShipmentShippedAt, InboundRecord, ReceivedRecord, ActualCost (Repair Centre), RepairNotes, Outcome (Repaired/Beyond Repair).

## 12.4 Return Orders (RE)
Reason: Defective | End of Rental | End of Lifecycle | Wrong Item | Other. Status: Initiated → In Transit → Received → Inspected → Closed. Inspection Outcome: Defective (→ Repair & Rework Order) | Scrap (→ SCRAP/DESTROYED, inactive). On Initiated: system auto-drafts Replacement Order.

# 13. FUNCTIONAL REQUIREMENTS — UPLOAD
Upload Centre provides downloadable templates and upload zones for: Terminals Receiving (serial import), Purchase Orders, Products, Sales Orders, Distribution Orders (inbound/outbound), Repair & Rework (outbound/inbound), PO Receipt Confirmation, State Update (warehouse states), Outbound Shipment Confirmation, Accessories Adjustment.
All uploads: per-row error report downloadable, audit log entry created, logged in mass_upload_log table.

# 14. FUNCTIONAL REQUIREMENTS — R2 FEATURES

## 14.1 Inventory Enhancements
Latest Date & Location columns on All Terminals view. In Transit expanded: EXPECTING + TRANSIT_TO_COMPANY + TRANSIT_TO_WAREHOUSE. Column filtering: all inventory/order list views with click-to-filter per column.

## 14.2 PO Received Date
ReceivedDate on PO Header (auto-populated on first receipt) and PO Line. Visible in PO Detail and export. Used to calculate actual lead time.

## 14.3 Cost Calculation Engine
On each state transition: look up Activity Cost Master (Location + State + optional Product); apply Exchange Rate Master to convert to reporting currency; add to AccumulatedCost; record in state history. Repair: standard estimate at IN_REPAIR; actual entered by Repair Centre; delta calculated.

## 14.4 Cost KPI Dashboards
Four views: (1) Cost per Serial (searchable, breakdown), (2) Cost by Location (total spend per warehouse), (3) Cost by Product Family (aggregated cost), (4) Repair Cost Analysis (actual vs standard per centre, delta %, amber >20%). All support export.

## 14.5-14.13 R2 Features Summary
14.5 Demand Planning: Demand Planner role, demand signals, forecasting.
14.6 Supply Planning: Safety stock targets, replenishment engine, gap/overflow dashboard.
14.7 Repositioning Planning: Identify excess/shortage, create plan, auto-generate DS.
14.8 ATP Engine: AVAILABLE inventory check, BOM expansion, co-located vs split sourcing, Business Calendar lead times.
14.9 Purchase Prediction: Forecast future POs from demand + lead times. Planner approves, auto-creates PO draft.
14.10 Work Orders: Auto-generated for multi-location BOM sourcing. Status: Pending → In Progress → Complete.
14.11 Claims Management: Created when received qty < expected on PO. Fields: POReference, Type, Description, Quantity, Status.
14.12 Alerting Framework: Configurable rules. Default: state dwell exceeded, rental expiry, return received, low stock, claim raised.
14.13 API Integration: Live GET from external Logistics API. POST/PATCH export of state changes and orders. Spec addendum TBD.

# 15. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|---|---|
| Performance | Inventory list views load <3 seconds for 10,000 records. Filters return <2 seconds. Cost dashboards <5 seconds. |
| Scalability | Designed for hundreds of serials and dozens of concurrent orders. PostgreSQL migration via connection string change only. |
| Data Integrity | All state transitions and cost calculations immutably logged. No state change without valid predecessor. No cost adjustment without state history entry. |
| Audit Trail | Complete immutable history per serial (state + cost per transition) and per order (status changes). |
| Security | bcrypt password hashing. Role-based access control at API level. JWT tokens. HTTPS on server. |
| Data Import/Export | Excel upload for all entities. All list and analytics views exportable to Excel. |
| Branding | Navbar: #1A6B7B. Document/report headers: #003087. Warnings/alerts: #F7941D. |
| Browser Support | Chrome, Edge, Firefox (latest 2 versions). No mobile requirement. |
| Deployment | R1/R2: local via single start command. Server: Linux + documented setup. PostgreSQL: connection string change. |
| Cost Normalisation | All activity costs stored in native currency; converted to warehouse reporting currency via Exchange Rate Master. |
| Business Hours | All duration calculations use Business Calendar. Default if not configured: Mon-Fri 08:00-17:00 UTC. |


# 16. TECHNICAL ARCHITECTURE

## 16.1 Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite | Hot reload, component-based. Teal green navbar. |
| Styling | Tailwind CSS | Custom tokens: --color-primary: #1A6B7B |
| Backend | Python FastAPI | Modular router structure. Auto-generates OpenAPI docs. |
| ORM | SQLAlchemy | SQLite (R1) → PostgreSQL (R2) via connection string. |
| Database | SQLite → PostgreSQL | SQLite for local; PostgreSQL for server. |
| Auth | JWT | Role claims in token. Refresh token for persistence. |
| File Processing | openpyxl + xlrd | Excel/XLS upload parsing. Export generation. |
| Cost Engine | FastAPI service layer | Triggered on state transition events. |
| Business Calendar | FastAPI service layer | Business hours calculation for state lead times and ATP. |


## 16.2 Backend Modules
R1: auth, products, suppliers, locations, location_types, business_calendars, transit_time_lanes, assembly_times, customers, terminal_states, state_transitions, activity_costs, exchange_rates, order_numbering, inventory, state_history, non_serialised_inventory, purchase_orders, inbound, outbound_orders/sales, outbound_orders/distribution, repair_rework, returns, upload, analytics, api_integration_stub.
R2 additions: cost_engine, cost_analytics, column_filters, demand_planning, supply_planning, repositioning, purchase_prediction, work_orders, claims, alerting, api_integration (active).

# 17. RELEASE PLAN

## 17.1 R1 Patch Items

| ID | Change | Effort | Priority |
|---|---|---|---|
| P-01 | Rename to IMS | Low | High |
| P-02 | Green navbar #1A6B7B | Low | High |
| P-03 | Merge nav: Warehouse Tasks | Low | Medium |
| P-04 | Merge nav: Admin | Low | Medium |
| P-05 | Rename Expecting → In Transit | Low | High |
| P-06 | Rename Non-Serialised → Accessories | Low | High |


## 17.2 R2 Release Phases

| Phase | Module | Key Deliverables |
|---|---|---|
| 2A | R1 Patches | All 6 patch items applied. |
| 2B | Inventory Enhancements | Latest Date/Location columns; In Transit expanded; column filtering all views. |
| 2C | PO Received Date | ReceivedDate on PO header and lines. |
| 2D | Cost Calculation Engine | State transition cost hook; FX conversion; accumulated cost per serial. |
| 2E | Cost KPI Dashboards | 4 cost analytics views with export. |
| 2F | Work Orders | Auto-generated warehouse assembly instructions for multi-location BOM. |
| 2G | Claims Management | Configurable claim types; claim on PO receipt discrepancy. |
| 2H | Demand Planning | Demand Planner role; demand signal management; forecast views. |
| 2I | Supply Planning + Repositioning | Safety stock; replenishment engine; repositioning planner. |
| 2J | Purchase Prediction | Forecast PO needs from demand + lead times. |
| 2K | Alerting Framework | Configurable alert rules; in-app + email notifications. |
| 2L | API Integration | Live GET/POST with Logistics API. Spec addendum first. |


# 18. OPEN ITEMS

| # | Topic | Description | Status |
|---|---|---|---|
| 1 | API Integration Spec | GET/POST/PATCH spec not confirmed. Separate addendum required. | Open — TBD |
| 2 | e2open Green Hex | #1A6B7B based on colour swatch. Confirm against brand guide. | Confirm |
| 3 | Exchange Rate Frequency | Manually maintained by Admin. No live FX feed. | Accepted |
| 4 | Column Filtering | Client-side for R1 volumes; server-side in R2 Phase 2B. | Accepted |
| 5 | Cost Engine Backfill | Cost engine applies from activation date. Historical transitions show zero unless Admin backfills. | Accepted |
| 6 | Carrier Integration | No live carrier API. Manual or mass upload. | Accepted |
| 7 | ERP Integration | Out of scope. IMS is standalone master of record. | Out of scope |
| 8 | Business Calendar Completeness | Must be populated by Admin per location/supplier. Default: Mon-Fri 08:00-17:00 UTC. | Admin to complete |
| 9 | Dispatch → RR Migration | v1.3 replaces Repair Orders with Dispatch/R&R model. R1 RR records migrated in R2. | R2 task |
| 10 | State Sequence Numbers | Informational only; do not enforce transitions. Admin must set during setup. | Admin to complete |
| 11 | Device Identifiers | ICCID, IMEI 1/2, EID, MAC addresses, Lot Number, Key ID, Terminal Type all added. From Terminals_receiving-Sample.xls. | Accepted |
| 12 | EID (eSIM) | EID field added. Empty in current sample data. Stored for future use. | Accepted — monitor |

---
END OF DOCUMENT
IMS PRD v1.3 Consolidated | May 2026 | Classification: CONFIDENTIAL
