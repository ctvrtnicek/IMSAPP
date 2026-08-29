# R3 — Remaining Items

Status as of 2026-08-29, checked against actual code (not just the PRD checklist).
Full R3 scope is in `SPECS/prd_appendixb.txt` section 4. This file tracks only what's
still open, so a fresh session doesn't have to re-derive it.

## Not implemented

- **#12 — AI Assistant (proactive, alert-aware).** DB tables exist
  (`ai_conversations`, `ai_messages` in `backend/models.py`) but there's no backend
  endpoint and no chat UI anywhere in the frontend. Nothing to build on beyond the
  empty tables.
- **#16 — Repair Shop Portal.** No dedicated portal component. `repair_centre` role
  currently just sees a restricted view of the normal internal dashboard (same
  pattern warehouse has). Compare to `frontend/src/pages/supplier/SupplierPortalPage.jsx`
  for what a real dedicated portal looks like here.
- **#17 — Warehouse Portal.** Same situation as #16 — `warehouse_user` gets a
  restricted "Warehouse Tasks" section within the normal dashboard, not its own
  portal.

## Partial / needs a decision before finishing

- **#9 — BOM Process, inbound multi-supplier.** `product_suppliers` (many-to-many
  with lead times) is wired into supply planning suggestions
  (`backend/routers/supply_planning.py`), and outbound ATP is done (#8, complete).
  But a Purchase Order is still single-supplier-per-PO at the header level
  (`purchase_orders.supplier_id`) — there's no multi-supplier-per-PO inbound flow.
  Needs clarifying what "inbound multi-supplier" should actually look like
  (multiple suppliers per PO? Or per-line supplier override?) before building it.
- **#13 — Page & Size Alignment (UI fix).** Can't verify from code — this is a
  visual QA pass across the app, not a specific feature. Needs an actual walkthrough.

## Confirmed done (for reference — don't re-investigate these)

Everything else on the 17-item R3 list, including the pieces recovered from the
Aug 28 stash on 2026-08-29 (branding, blue theme, Admin section split, goods
receipt dialog/reverse, PO line pricing — full backend-to-UI, RMA reference fields,
gated AI document upload for serial extraction, and the APScheduler job that runs
the shortage agent on schedule).
