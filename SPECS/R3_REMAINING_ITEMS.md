# R3 — Remaining Items

Status as of 2026-09-22, checked against actual code (not just the PRD checklist).
Current PRD: `SPECS/IMS - PRD v3.0 Consolidated_new.docx`. Its R3 detail sections
(5.1–5.17) are identical to v2.2 — v3.0/v3.0_new only add Appendix B agents
(IMS_Procurement, and in _new IMS_CustomerPriorityManager + `desired_edd` on SO/RN/RP,
which is agentic work outside the 17 R3 items). `prd_appendixb.txt` is a truncated
v2.2 extract (stops at 5.1) — don't use it for detailed specs.

Agreed finishing order: #17 → #16 → #9 → #12 → #13. #17, #16, #9 and #12 closed 2026-09-23; #13 closed 2026-09-24 — all R3 items done.

## Data visibility rule (#14 / #16 / #17) — decided 2026-09-22

Implemented server-side in `backend/scoping.py` (applied to inventory, POs,
outbound/DS, work orders, returns, both repair tables, search, traceability,
warehouse tasks, analytics). The browser never supplies the filter.

A location-scoped user (warehouse_user, repair_centre) with assigned locations L sees
an object if L is involved in it now **or was at any point in the past** —
visibility never shrinks:

| Object | Visible when |
|---|---|
| Terminal serial | current location in L, OR any state_history row at L, OR on a PO / DS / repair order involving L (expected + in-transit) |
| PO | destination in L — from creation, before receipt |
| SO / RN / RP | fulfilling location in L |
| DS | origin OR destination in L — from creation |
| Repair orders (RR + repair-centre orders) | repair centre OR return location in L |
| Returns | original order visible, or any serial on it visible |
| Work orders | location in L |
| Accessories (non-serialised) | location in L (no history exists) |
| Analytics | **narrower**: only stock currently at L and orders involving L |
| Alerts | location in L (server-side since 2026-09-23); full rebuild in R4 with the agents |

Writes (warehouse state updates, recharge WOs) are limited to terminals physically
at L.

**ASSUMPTION (may change):** a returned terminal comes back to the same warehouse
that shipped it. Return visibility relies on this via the serial-history rule.

Supplier users: scoped to `users.supplier_id` (their POs + serials on those POs).
Repair Centre users: scoped by **location** (location type Repair Centre), not by
supplier — PRD §5.1's "linked to one Supplier entity" wording for repair centres is
wrong.

Multi-role: any internal role → unrestricted (strongest right; region scoping for
internal roles still not implemented). Several scoped roles (e.g. repair_centre +
supplier) → union. Supplier-only users land on `/supplier-portal`; multi-role users
land on the dashboard and get a "Supplier Portal" sidebar item (portal has "Back to
IMS").

## Not implemented

(none — R3 complete)

## Confirmed done (for reference — don't re-investigate these)

**#13 Page & Size Alignment** — closed 2026-09-24 after Jakub's local test. PO/SO/RN/RP/
DS/RR/RE details render identically from the list (dashboard) and by link (standalone):
detail root carries `.e2o-detail` (max-width 1400); while one is open the list's section
title / tab row (`.e2o-list-chrome`) is hidden via `main:has(.e2o-detail)`; standalone
pages drop the top-bar Back (the detail's own ← Back is the only one) and use the
dashboard's 32px padding; `main { scrollbar-gutter: stable }` stops the width jumping
between short and long pages. Measured at 1440×900: header card 1141px wide, content
top 84px, one Back, in both paths for every type.

**#12 AI Assistant** — closed 2026-09-23 after Jakub's local test. Decisions
(Jakub, 2026-09-23): passive assistant — reads, interprets, explains, and can
acknowledge alerts directly (runs with the user's own rights/visibility; alert
actions extend when alerts are rebuilt in R4); per-role on/off
(`AI_ASSISTANT_ROLES`, default all internal roles, not repair centre/supplier);
one platform-wide model (`AI_MODEL`, default Claude Opus 5 — also used by the
document processor and shortage agent now); answers "how do I…" from
`backend/assistant_knowledge/process_guide.md` (current behaviour, kept in sync per
CLAUDE.md rule) with PRD v1.3/v3 + test cases as searchable references.
Code: `backend/ai_assistant.py`, `routers/assistant.py`, `ai_config.py`,
`migrate_v28.py`, `frontend/src/components/AssistantPanel.jsx`. Streaming SSE chat,
7 tools, opening "needs attention" card computed without a model call, history in
ai_conversations/ai_messages. `anthropic` added to requirements.txt (was missing —
AI features could not run on Render).
Keys must be workspace-scoped (an org-level key gets 400 "not scoped to a workspace").
Top-bar button "✦ Ask AI". Alerts API now requires login + location scoping
(separate commit).

**#9 BOM Process** — closed 2026-09-23 after Jakub's local test. Decisions
(Jakub, 2026-09-23): consume components at shipping (physical deduction only when
goods leave the warehouse; allocation just confirms the reservation — reconfirmed); accessories are *reserved*
per order (free = on hand - reserved), and shipping stock reserved for other orders
asks for confirmation + raises RESERVATION_AT_RISK; shipping more than is physically
on hand is blocked; one auto-drafted Draft DS per component per source warehouse,
issued by the Supply Planner; assembly lead time = longest across components; the
Pick WO lists every BOM part (accessory qty lines) and has an Assembly section —
"Assembly done" after Start, production time = confirm time - start time, WO can't
complete before it. Inbound = read-only BOM Component Supply panel (stock per
location, reserved, free, short, open POs) on BOM order detail and Products → BOM
Config; accessory PO lines can now be received by quantity (before, PO receipt never
touched accessory stock). Code: `backend/accessory_stock.py`, `backend/bom_planner.py`
(called from `atp_engine.run_atp_for_order`), `migrate_v27.py`. Orders created before
#9 have no reservations/BOM status and ship as before.
Kits (added after Jakub's test, 2026-09-23): a BOM with a serialised component
(V400-Kit = V400M + cable) has no serials of its own — ATP searches and pegs the
component terminals instead, accessories are reserved as usual, terminals pegged at
another warehouse move to the kitting warehouse on a transfer DS. Allocation
preselects the component terminal; cable-only orders allocate without serials.
Cancelling an order now also unpegs its terminals (they used to stay pegged).
Allocation dialog: accessory lines are confirmed by quantity (serial search greyed
out); cable-only orders show "Allocate Accessories" and confirm in one click.
ATP rules agreed 2026-09-23 (after SO000027 jumped to Sacramento):
(a) Run ATP again = drop the whole plan (unpeg, release reservations, cancel draft
transfer DS) and plan afresh, after a confirm dialog; refused once the order is
allocated or an ATP transfer DS was issued (`bom_planner.atp_rerun_blocker`).
(b) search order: order's Fulfilling Location → warehouses with a Network Design flow
to the customer (current version) → regional search. A kit on an order with a
Fulfilling Location is assembled there; terminals found elsewhere come on a DS.
(c) a transfer DS only counts as incoming if it goes to the current warehouse.
(d) ATP Step 4 skips POs whose expected date has passed; PO pegs now get an EDD.
Supply panel on an order lists only POs into that order's fulfilling warehouse.
Known, not fixed: Step 4 PO pegging isn't persisted, so several orders can count the
same open PO quantity (pre-existing ATP behaviour).
Pegging vs allocation (fixed 2026-09-23): allocation ignored ATP pegs. Now the
allocation dialog pre-selects terminals pegged to the order and blocks ones pegged to
another open order (API refuses too); allocating pegs the terminal to the order; once
a line is fully allocated, un-picked pegs are released; shipping clears the order's
pegs; a delivered kit transfer DS hands the terminals that actually travelled to the
parent order. Delivered terminals arrive RECEIVED and need goods-in (→ Available)
before they can be allocated. One-off local clean-up unpegged terminals held by closed
orders (SO000021, SO000029).
UI: breadcrumb trail on all detail pages (order/DS/PO/WO/repair/return/terminal,
`components/Breadcrumbs.jsx`, sessionStorage, reset from dashboard lists/menu);
Components & Reservations lists kit terminals (pegged) + accessories; "← Back" on all
detail pages.
Note: V400M itself is also flagged BOM in master data (V400M + cable, 8 days) — that
is why a plain V400M order shows BOM status and the supply panel.
Also fixed along the way: `generate_pg_schema.py` now emits
`ADD COLUMN IF NOT EXISTS` for every column (CREATE TABLE IF NOT EXISTS never added
new columns to existing tables on Render) and sorts tables for stable output.
Before pushing: `export_seed.py` so the two new alert rules reach Render.

**#17 Warehouse Portal** — closed 2026-09-23 after Jakub's local test (Oostrum and
Memphis users each see only their own terminals, orders, R+R). No separate portal:
normal navigation, role-limited menu, server-side scoping per the rule above.
Note when testing: nearly all seed data flows out of Oostrum, so an Oostrum user
legitimately sees stock now at Memphis/DHLAU etc. via history — use a Memphis user
to see the restriction clearly.

**#16 Repair Shop Portal** — closed 2026-09-23 after Jakub's local test. May be
revisited in R4 when repair orders are auto-created.
Same pattern as #17 (normal navigation, scoped by repair-centre location).
Repair-only users get only the Repair Orders tab (Returns = No access, also
enforced in the API and search). Documents moved to a new table
`repair_order_documents` (FK → `repair_orders`, file bytes in the DB so they
survive Render deploys) with upload / list / download; old `repair_documents`
(wrong FK to `repair_rework_orders`, disk storage) dropped locally by
`migrate_v26.py`. On Render the old empty table just stays unused.
Repair status actions and role checks now honour all of a user's roles.
Return → Repair (added 2026-09-23 at Jakub's request): repair orders show the
originating Return Order and when/by whom they were created (detail + list).
Warehouse users can Create Repair Order from a return inspected as Defective
that was received at one of their warehouses (receiving warehouse = original
order's fulfilling location, per the returns assumption). Admin/planner as
before. One repair order per return (RE000003 has two parallel repairs from
before this rule). The button lives on the Return Order detail, not the Repair
Orders list. Repair centre must be a Repair Centre location; return location
defaults to the receiving warehouse.
Deferred to R4 (Jakub, 2026-09-23): Traceability → "Initiate RMA" still creates
its repair order in the legacy `repair_rework_orders` table, which no screen
lists (`RepairReworkPage.jsx` is unreferenced) and whose RR numbers clash with
`repair_orders`. Fix with the R4 auto-draft repair / RMA work.

Everything else on the 17-item R3 list, including the pieces recovered from the
Aug 28 stash on 2026-08-29 (branding, blue theme, Admin section split, goods
receipt dialog/reverse, PO line pricing — full backend-to-UI, RMA reference fields,
gated AI document upload for serial extraction, and the APScheduler job that runs
the shortage agent on schedule). #15 Supplier Portal (`/supplier-portal`: My POs,
Import Serials incl. AI extraction, Alerts).
