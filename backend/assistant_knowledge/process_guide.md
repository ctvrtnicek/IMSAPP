# IMS — Process Guide (how the system works today)

This guide describes the Inventory Management System (IMS) **as it is currently built**.
It is the assistant's primary source for "how do I…" questions. When it differs from the
PRD or older test cases, this guide is right.

MAINTENANCE RULE: every change to a user-visible process updates this file in the same
commit (see CLAUDE.md). Last reviewed: 2026-09-24 (R3 #17, #16, #9, #12 + Inventory Moves).

---

## 1. The business in one paragraph

Terminal Distributor distributes serialised **payment terminals** (e.g. Verifone V400M)
worldwide. IMS tracks every terminal by **serial number** through a configurable state
machine (purchase → receipt → stock → sale/rental/replacement → return → repair → back to
stock or scrap), plus **accessories** (cables, batteries — counted per location, no serials).
Locations are **Warehouses** (e.g. Oostrum, Memphis, Sacramento, DHLAU, Changi, Sorocaba),
**FSLs** (forward stocking locations, e.g. FSLUK), **Repair Centres** (e.g. VerifoneREPAIR),
**Partners** and **Customer** locations.

## 2. Roles and what each can do

| Role | Typical person | Can do |
|---|---|---|
| Admin | system owner | everything, incl. Admin menu (master data, users, System Config) |
| Supply Planner | planning team | create/issue POs and outbound orders, allocate, run ATP, plan supply, create repair orders |
| Demand Planner | planning team | demand signals, forecasts; read most other areas |
| Warehouse User | warehouse staff | receive POs, pick/assemble/ship via work orders, state updates, receive returns, inspect, create repair orders from returns received at their warehouse |
| Repair Centre | repair shop staff | their repair orders only: receive, in repair, complete, return, upload documents |
| Supplier | vendor | Supplier Portal only: their POs, import serials (incl. AI document import), alerts |
| Inbound / Outbound Specialist, RMA Manager, Senior Management | R3 roles | per the role matrix; Senior Management is read-only |

**Data visibility.** Warehouse and Repair Centre users are tied to **locations** and see
only data for those locations — anything that is or ever was at their location
(terminals by state history, POs to their warehouse, orders from/to their warehouse,
repair orders at/returning to their location). Analytics shows only stock currently at
their locations. Supplier users see only their own supplier's POs. Internal roles (admin,
planners, specialists, management) see everything. A user with several roles gets the
widest access.

## 3. Navigation (left menu)

Dashboard · Inventory · Orders · Distribution · Returns & Repairs · Demand · Supply ·
Analytics · Warehouse Tasks · Alerts · Admin. Menu items a role has no access to are hidden.
- **Inventory** tabs: All Terminals, By State, By Location, By Product, In Transit,
  Accessories, Traceability, Inventory Moves.
- **Orders** tabs: Purchase Orders · Sales / Rental / Replacement · Claims.
- **Returns & Repairs** tabs: Return Orders · Repair Orders (repair-centre users see only
  Repair Orders).
- **Warehouse Tasks** tabs: Warehouse Tasks (state updates) · Work Orders.
- **Admin**: master data (Locations, Suppliers, Products incl. BOM, Customers, Users & Roles,
  Terminal States, Calendars, Regions & Countries, System Config, Agentic) and supply-chain
  set-up (Cost Master, FX Rates, Claim Types, Alert Rules, ATP Configuration, Network
  Design, Firmware, Upload).
- Global **search** box (top of the menu) finds terminals, orders, products, etc. —
  within the user's visibility.
- Detail pages show a **breadcrumb** trail (e.g. SO000030 › DS000040 › WO000027).

## 4. Terminal states (main ones)

EXPECTING (on a PO, not yet received) → QUARANTINE or QUALITY_HOLD (just received) →
STAGING / ENCRYPTION_KEY_LOADED / RECHARGED (prepared) → AVAILABLE (sellable) →
TRANSIT_TO_COMPANY (shipped to customer) → RECEIVED (delivered).
Distribution: TRANSIT_TO_WAREHOUSE → RECEIVED (at destination; goods-in to Available).
Returns: UNDER_INVESTIGATION (return received) → DEFECT / SCRAP.
Repair: TRANSIT_TO_REPAIR → IN_REPAIR → QUARANTINE_REFURBISHED → AVAILABLE_REFURBISHED.
Warehouse users move terminals between warehouse states in **Warehouse Tasks**.

## 5. Inbound — Purchase Orders

1. **Create PO** (Admin, Supply Planner): Orders → Purchase Orders → + New PO. Pick supplier,
   destination warehouse, lines (product, qty, optional unit price/currency). Status Draft.
2. **Issue** (Admin, Supply Planner) → status Issued.
3. **Import serials** (supplier via Supplier Portal, or internal users): enter serials, upload
   XLS, or upload a PDF/image and let AI extract them (if enabled). Serials become EXPECTING.
4. **Receive** (Warehouse User, Admin, Supply Planner, Inbound Specialist, …): Goods Receipt
   dialog — each serial goes to QUARANTINE or QUALITY_HOLD (Quality Hold raises an alert).
   **Accessories** (non-serialised lines, e.g. cables) are received by **quantity** with the
   Receive button on the PO line; stock is added to the destination warehouse.
5. PO status follows receipts: Partially Received → Fully Received. Admin can reverse a
   goods receipt. Discrepancies can be raised as a **Claim**.

## 6. Outbound — Sales (SO), Rental (RN), Replacement (RP), Distribution (DS)

1. **Create order** (Admin, Supply Planner): Orders → Sales / Rental / Replacement (DS under
   Distribution). Customer (or destination warehouse for DS), optional fulfilling location,
   lines. **ATP runs automatically** on creation.
2. **ATP (Available to Promise)** finds stock and **pegs** (reserves) terminals to the order.
   Search order: the order's Fulfilling Location → warehouses with a Network Design flow to
   the customer → the customer's region → other regions. Steps per location group:
   Available → staging states → expected (EXPECTING) → issued POs (overdue POs are skipped).
   Result per line: ATP OK / PARTIAL / NONE, EDD (estimated delivery date), and a reasoning
   log ("ATP Reasoning" on the order).
3. **Run ATP again** (Admin, Supply Planner): asks for confirmation, then **drops the whole
   plan** (pegs, reservations, draft transfer DS) and plans afresh. Not allowed once the
   order is Allocated or a transfer DS created by ATP has been issued. **Unpeg** releases
   the order's pegged terminals.
4. **Issue** (Admin, Supply Planner) → Issued.
5. **Allocate** (Admin, Supply Planner): pick serials per line. Terminals ATP pegged to this
   order are pre-selected; terminals pegged to another open order cannot be taken.
   Accessory-only orders (e.g. a cable DS) are allocated without serials ("Allocate
   Accessories"). Allocation creates a **Pick Work Order** for the warehouse.
6. **Work order** (Warehouse User): Acknowledge → Start → pick each line (serials; accessories
   by quantity) → for BOM/kit orders confirm **Assembly done** → Complete. The order can't
   ship while its work order is open.
7. **Ship** (Admin, Supply Planner, Warehouse User): carrier, tracking, cost → Shipped;
   terminals go to transit; reserved accessories are deducted from stock; pegs are cleared.
   If the shipment would use accessories reserved for other orders, IMS warns and asks to
   confirm (the affected orders get an alert). Shipping more than is physically on hand is
   blocked.
8. **Deliver** → Delivered. For a DS, terminals arrive RECEIVED at the destination and
   accessories are added to its stock.
9. **Cancel** (Admin, Supply Planner) while Draft / Issued / Allocated — releases pegs and
   reservations and cancels draft transfer DS.

## 7. BOM products and kits

- A product flagged **Bill of Materials** in Admin → Products has components (BOM Config
  tab) with quantity per unit and an assembly lead time.
- **Serialised BOM** (e.g. V400M = terminal + cable): the terminal's own serials are
  allocated; the cable is a component.
- **Kit** (a BOM containing a serialised component, e.g. V400-Kit = V400M + cable): the kit
  has no serials of its own — ATP pegs V400M terminals for it and the allocation dialog
  offers V400M serials.
- Components are **reserved** at the fulfilling (kitting) warehouse: free = on hand −
  reserved. Missing components → ATP **auto-drafts a Distribution Order** from another
  warehouse (status Draft, "Component Transfer Orders" on the order); the Supply Planner
  issues it. Nothing anywhere → "Components missing" + a COMPONENT_SHORTAGE alert.
- BOM status per line: Components complete / Components in transfer / Components missing.
- EDD = later of terminal and component arrival + transit + the longest component assembly
  lead time.
- The order's **Components & Reservations** section and the **BOM Component Supply** panel
  show stock per location (on hand, staging, reserved incl. "this order", free, short) and
  incoming POs for the fulfilling warehouse.
- Components are deducted from stock when the order **ships** (physically leaves).

## 8. Returns and repairs

1. **Create return order** (Admin, Supply Planner, Warehouse User): Returns & Repairs →
   Return Orders. Status Initiated.
2. **Mark Received** (Warehouse User, Admin): terminals go to UNDER_INVESTIGATION at the
   receiving warehouse. ASSUMPTION: a terminal returns to the warehouse that shipped it.
3. **Set inspection outcome**: Defective or Scrap → status Inspected.
4. **Create repair order** — only from a return **inspected as Defective**, from the Return
   Order detail page ("Create Repair Order" button). Who: Admin, Supply Planner, or a
   **Warehouse User at the warehouse where the return was received**. One repair order per
   return. Choose a Repair Centre location; return location defaults to the receiving
   warehouse. Repair orders are **not** created automatically (planned for R4).
5. Repair flow (Repair Centre user or Admin): Dispatched → Received at Repair Centre → In
   Repair → Completed (outcome, cost) → Returned to warehouse. Documents (PDF/JPG/PNG, max
   2 MB) can be uploaded on the repair order.
6. Repair orders show the originating return order and when/by whom they were created.

## 9. Warehouse tasks

- **State updates**: move terminals at your location between warehouse states (e.g.
  QUARANTINE → AVAILABLE after goods-in checks).
- **Work orders**: Pick work orders from allocations (see §6); **Recharge** work orders for
  terminals whose battery needs recharging (Battery Aging alert).
- Delivered DS terminals arrive RECEIVED and need goods-in (state update to Available)
  before they can be allocated.

## 10. Planning

- **Demand**: demand signals, long-term forecast, forecast inventory view.
- **Supply**: stock targets (safety stock / reorder point per product and location),
  replenishment planner, repositioning between locations, purchase predictions and
  purchase requisitions.
- **Network Design** (Admin): regions, countries, supply flows between locations (and to
  customers); the current committed version drives ATP's preferred sources.
- **Shortage agent** (Admin → Agentic): runs on a schedule (default 09:00 and 15:00),
  proposes allocations / requisitions for forecast shortages; humans approve above
  thresholds.

## 11. Alerts

Bell icon and Alerts page. Rules include: Return Received, Repair Overdue, In-Transit
Delay, Low Stock, Battery Aging, Warranty Expiry, Quality Hold Raised, BOM Component
Shortage, Accessory Reservation At Risk. Severity: Critical / Urgent / Normal. Users
**acknowledge** alerts once handled (recorded under their name). Warehouse and Repair
Centre users see and acknowledge only alerts at their own locations. Running the alert
engine and editing Alert Rules (Admin → Alert Rules) is admin-only.
(The alerting framework is scheduled for a rebuild in R4.)

## 11a. Inventory Moves report (month-end)

Inventory → **Inventory Moves**. For a chosen month (filters: period, from, to) it lists
terminals that changed jurisdiction or left / re-entered the company's books, per route
and product, with **quantity**, **standard value** (product master value — refurb value
for refurbished stock — in EUR) and **accumulated cost** (costs booked on the terminal up
to the move, EUR). Click a quantity to see the serials; export per serial to CSV.
Categories: cross-border moves between company warehouses/FSLs in **different countries**
(e.g. Oostrum NL → Memphis US; same-country moves are not listed), to customers (out of
the books), to partners, to repair centres, returns from customers / partners, returns
from repair centres. Which date a move counts on is set in Admin → System Config:
MOVES_DATE_BASIS_SALES / _DISTRIBUTION / _REPAIR = arrival (default) or departure;
returns always count on arrival. The report can be run for any past month — it is
calculated from terminal history. The Terminal detail page header also shows the
product's standard value.

## 12. Claims

Orders → Claims. Raised against a carrier or supplier for a PO receipt discrepancy or a
shipment problem (Admin, Supply Planner, Warehouse User); reviewed and resolved by Admin /
Supply Planner. Attachments supported.

## 13. Known limitations (current release)

- Traceability → "Initiate RMA" creates a legacy repair record not shown in Repair Orders
  (to be fixed in R4) — create repair orders from the Return Order page instead.
- ATP counts open PO quantity without reserving it, so two orders may count the same PO.
