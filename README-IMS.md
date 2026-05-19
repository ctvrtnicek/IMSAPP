The Inventory Management System (IMS), is a purpose-built standalone web application for Payment Terminal Distributor — a global payment terminal distributor 
managing serialised payment devices across a worldwide warehouse network. The application serves as the master system of record for terminal serial number states, 
inventory counts, order management, and cost tracking, project demand signals and execute supply planning operations.

Main personas are supply planner, demand planner, warehouse operator, cost control manager, supplier, repair centers, 

Business objectives are:
1.	Serial-Level Whereabouts: Monitor location and status of every terminal by serial number at all times.
2.	Inventory Overview: Real-time counts of terminals by product and by location across all states.
3.	Cost Tracking: Track activity costs per terminal (per state transition) and aggregate cost totals, normalised to reporting currency.
4.	Cost Analytics: KPI dashboards for accumulated cost per terminal, cost by location, cost by product family, and repair cost analysis.
5.	Inventory Planning (R2): Identify locations where terminals are missing or in overflow; support repositioning.
6.	Collaboration: Enable Supply Planner, Warehouse User, Repair Centre, and Supplier to collaborate on a single record.
7.	Repositioning Planning (R2): Allow planning of terminal transfers between warehouses.
8.	KPIs & Analytics: Dwell times, repair times, transit times, order fulfilment rate, return rates, cost metrics.
9.	Return & Repair Management: Full return and repair lifecycle at serial number level including Scrap/End of Lifecycle.
10.	Available-to-Promise: Instant ATP confirmation on outbound orders.
11.	Purchase Prediction (R2): Forecast new purchase orders from suppliers.
12.	Master Data Management: All reference data managed by Admin with Excel upload support.

Technology stack: React + Vite frontend with e2open teal green (#1A6B7B) navbar, Python FastAPI backend, SQLite (local) upgradeable to PostgreSQL, Tailwind CSS.

Release 1: 
Master Data (Products/BOM, Suppliers, Locations, Transit Times, Assembly Times, Customers, States, Activity Costs, Exchange Rates, Order Numbering)
Serial Number Tracking + Configurable State Machine + 1:N State History
Accessories Inventory (count per location, Received/Available)
Inbound Flow (PO Header+Lines, Serial Import, Receipt Confirmation, qty ordered/expected/received view)
Outbound Orders (Sales SO, Rental RN, Replacement RP, Distribution DS) + ATP + Kit Fulfillment
Return & Repair (Return RE, Repair RR, Scrap outcome, auto-draft Replacement)
Mass Upload (PO receipt, state updates, shipment confirmation, accessories adjustment)
Analytics & KPI Dashboard (inventory, dwell times, repair times, order metrics)
User Roles & Auth (Admin, Supply Planner, Warehouse User, Repair Centre, Supplier)
API Integration Module (stub/scaffold)

Release 2: 
Inventory: Latest Date & Location column
In Transit view: full transit states
Column filtering on inventory views
PO: Received Date field
Cost Calculation engine
Cost KPI Dashboards
Demand Planning
Supply Planning
Repositioning Planning
