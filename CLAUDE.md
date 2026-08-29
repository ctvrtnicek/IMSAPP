# IMSAPP — working notes for Claude Code

## Stack & layout
- Backend: FastAPI + SQLAlchemy, `backend/main.py`. Local DB: SQLite
  (`backend/terminal_tracking.db`). Deployed DB: Postgres on Render.
- Frontend: React + Vite, `frontend/`. Deployed on Netlify.
- Deploy: pushing to `main` on GitHub auto-deploys both Render (backend) and
  Netlify (frontend). See `SPECS/IMSAPP_Deploy RENDER+NETLIFY_Reference.docx`
  for the full setup and lessons learned from getting it working.
- Open R3 work: `SPECS/R3_REMAINING_ITEMS.md` — check this before starting a new
  R3 session so work doesn't re-derive what's already known to be open/done.

## Workflow: local-first, deploy only on confirmation

Do **not** `git push` to `main` as soon as a feature/fix looks done locally.
Render and Netlify auto-deploy off `main`, so every push immediately goes live
on the demo space — that's appropriate once something's actually confirmed
working, not while it's still being iterated on.

The loop:
1. Build and test the change against the **local** SQLite DB
   (`backend/terminal_tracking.db`) and local dev servers
   (`uvicorn main:app --reload`, `npm run dev`). Commits are fine to make
   locally along the way — commits don't deploy anything, only pushes to
   `origin/main` do.
2. Hand it to the user to try locally and flag bugs/finetunes. Iterate.
3. Only once the user confirms it's good, push to `origin/main` — that's what
   ships it to Render + Netlify.

If asked to "just push" or "ship it" without an explicit local test pass having
happened, ask first rather than assuming — this reverses the default from
earlier in the project (push-as-you-go), so don't fall back to old habit.

## Data sync: keeping Render's Postgres in sync with local dev data

The seed data on Render (master data, transactions, system config — anything
seeded from `seed.sql`) needs to be regenerated and pushed whenever local dev
data changes meaningfully, or it silently drifts from what's in local SQLite.

**Before a push that includes new/changed local data:**
```bash
cd backend
python tools/generate_pg_schema.py   # only needed if models.py / DB schema changed
python tools/export_seed.py          # always — regenerates seed.sql from local data
```
Commit the regenerated `schema.sql` / `schema_postgres.sql` / `seed.sql` (repo
root) together with the code change, then push per the workflow above.

**What happens after the push** — no extra manual step needed in the normal
case: `backend/main.py`'s startup handler re-runs `init_database()` (schema +
seed) on every fresh Postgres container boot, which Render does on every
deploy. It's idempotent — every `seed.sql` INSERT uses `ON CONFLICT DO
NOTHING`, so re-running it only fills in what's actually new or changed;
existing rows are left alone. So pushing the regenerated seed.sql is normally
sufficient by itself.

**If something needs to be forced or diagnosed** (a schema change didn't take,
data looks stale, etc.), there are admin-only endpoints for it — no direct DB
access needed:
- `GET /api/agents/status`-style pattern: `GET /api/admin/db/status` — row
  counts for key tables + the last schema/seed run's result.
- `POST /api/admin/db/reseed` — re-runs schema+seed on demand (background task,
  returns immediately, poll `/status`). Pass `?drop_first=true` only for a
  genuinely broken schema state (wipes and rebuilds everything) — not for
  routine data sync, which the auto-apply-on-deploy already handles.

Known limitation: `export_seed.py` exports binary columns (product images,
claim attachments) as NULL rather than inlining them — see the comment at the
top of that file for why. Not worth revisiting unless those specific features
become a priority.
