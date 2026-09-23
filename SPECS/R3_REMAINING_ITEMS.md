# R3 — Remaining Items

Status as of 2026-09-22, checked against actual code (not just the PRD checklist).
Current PRD: `SPECS/IMS - PRD v3.0 Consolidated_new.docx`. Its R3 detail sections
(5.1–5.17) are identical to v2.2 — v3.0/v3.0_new only add Appendix B agents
(IMS_Procurement, and in _new IMS_CustomerPriorityManager + `desired_edd` on SO/RN/RP,
which is agentic work outside the 17 R3 items). `prd_appendixb.txt` is a truncated
v2.2 extract (stops at 5.1) — don't use it for detailed specs.

Agreed finishing order: #17 → #16 → #9 → #12 → #13. #17 and #16 closed 2026-09-23.

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
| Alerts | unchanged — rebuilt in R4 together with the agents |

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

- **#12 — AI Assistant (proactive, alert-aware).** DB tables exist
  (`ai_conversations`, `ai_messages`) but no backend endpoint and no chat UI.
  PRD §5.17: chat bubble in top nav, slide-in panel, streaming, alert list/ack
  from chat, context (page + role), `AI_ASSISTANT_ENABLED` / `ANTHROPIC_API_KEY`
  in System Config.
- **#9 — BOM Process.** PRD §5.10 answers the earlier open question: inbound =
  components bought from different suppliers on **separate POs**, arrivals tracked
  against the BOM product (no multi-supplier PO). Outbound is also open: `atp.py`
  has no BOM logic; `bom_assembly_status` / `component_transfer_orders` exist on
  order lines but nothing populates them (auto-draft component DS, EDD recalc,
  shortage alert per missing component).

## Needs a walkthrough

- **#13 — Page & Size Alignment.** PRD §5.5 scope: open PO/SO/RN/RP/DS/RR/RE detail
  screens from their list view and from a Terminal Detail hyperlink, confirm
  identical layout. Do last, as a regression pass.

## Confirmed done (for reference — don't re-investigate these)

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
