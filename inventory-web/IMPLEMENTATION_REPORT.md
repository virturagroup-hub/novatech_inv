# Inventory iteration implementation report

Historical implementation snapshot. The subsequent [PREPRODUCTION_AUDIT.md](./PREPRODUCTION_AUDIT.md)
supersedes the validation counts, model-resolution limitation, permissions detail,
deployment instructions and Git snapshot below. All audit fixes remain local.

## Repository and schema audit

- Repository: `https://github.com/virturagroup-hub/novatech_inv.git`, branch `main`.
  The working tree was clean before implementation. All changes are under
  `inventory-web`. No push, merge, production SQL mutation, or deployment occurred.
- Read the existing schema, all migrations, role helpers/RLS, Supabase clients,
  inventory provider/audit triggers, NPN/model selection, both part editors,
  Green Machines/events, notifications/receipts, archive/restore/retention, QR
  paths, service worker, and Vercel project association.
- A read-only production REST schema inspection confirmed `inventory_role`, UUID
  parts/models/profiles, text workspace IDs, the JSONB workspace payload, and the
  expected audit/retention columns. Production RLS/function bodies were not
  available through REST; validation used the checked-in migrations.
- Machines, their timeline events, and notifications already use
  `workspace_records`; no competing notification or machine store was introduced.
  New normalized salvage rows reference that store and retain source snapshots.
- Existing inventory audit triggers generate quantity entries. Fulfillment and
  intake reuse those triggers; zero-delta reservation events use the same audit
  table. The existing heuristic machine-transfer matcher is avoided for new
  salvage events; transaction lineage is assigned in the same database transaction.
- Existing machine deletion and client retention could discard visible timeline
  history. Those client paths now retain history; database source references are
  nullable and machine snapshots survive deletion.
- Existing Add Part sheet had an unreachable footer at some viewport sizes. Its
  height/scrolling and mobile width now keep Save reachable. The sheet accepts
  initial drafts and an awaited transactional save callback, preserving its NPN,
  category, stock, location, notes, and model-family selection controls.

## Files and modules

| Module/files | Change |
| --- | --- |
| `src/app/api/cron/*`, `src/lib/cron-auth.ts`, `middleware.ts`, `vercel.json` | Protected read-only keepalive and separate daily consolidated notice job; cron routes bypass browser session refresh only. |
| `supabase/migrations/20260907161719_inventory_reservations_salvage.sql` | Reservation locking, stock guards, salvage templates/checklists, atomic intake, lineage, automatic disposal/archive, notification deduplication, RLS/grants. |
| `src/components/reservations-panel.tsx`, `stock-availability.tsx` | Online reservation controls, history, and unconfirmed/last-loaded availability labels. |
| `src/components/salvage-workflow.tsx`, `src/app/pending-inventory/page.tsx` | Machine checklist and shared queue, searchable by PN/NPN, technician, component/category, model/serial, plus minimum age. |
| `src/components/part-editor-sheet.tsx` | Reused inventory form, source defaults, required source model, awaited save/errors, mobile scrolling/footer. |
| `src/components/pages/{inventory,lookup,model-detail,part-detail,green-machine-detail,green-machines,notifications}-page.tsx` | Availability, reservation/checklist integration, disposal labels, source lineage display, queue links. |
| `src/components/{inventory,workspace-content}-provider.tsx` | Surface stock write errors, refresh shared state after transactional actions, retain machine history and server-owned retention behavior. |
| `src/lib/supabase/{inventory,types}.ts`, `src/lib/{inventory-types,inventory-utils,inventory-workflows,workspace-content-types,admin-health,green-machine-retention,app-navigation}.ts` | Typed workflows, consistent availability snapshot, nullable historical references, audit labels, source-model matching, navigation. |
| `tests/database-workflows.mjs` | Real PostgreSQL migration, concurrency, permission, lifecycle, audit, lineage tests. |
| `tests/browser/*`, `tests/mock-supabase.mjs`, `playwright.config.ts` | Phone/desktop application workflow tests with test-only API transport. |
| `package.json`, `package-lock.json`, `.gitignore` | Test scripts/dev dependencies and ignored generated artifacts. |
| `README.md`, `MIGRATION_PLAN.md`, `supabase/phase2_schema.sql`, this report | Setup, migration order, audit and operational documentation. |

## Database and permissions

- Added `inventory_reservations`: active/fulfilled/cancelled, owner/actor, quantity,
  timestamps, notes, and part snapshot. Creation locks the part before summing
  active holds; resolution locks part then reservation. Request IDs and terminal
  states make retries safe. All existing stock update paths are guarded against
  reducing physical quantity below active holds or archiving held inventory.
- Added RLS-aware `inventory_availability` view. Its physical quantity and hold
  total are read together, avoiding mismatched concurrent snapshots.
- Added salvage profiles/components and `machine_salvage_items`. Model/series
  matching selects templates; legacy active machines receive unresolved defaults.
  All checklist outcomes and pending intake are durable records, not dummy parts.
- New write RPCs require an active Admin/Manager/Technician profile. Owners can
  cancel/fulfill their holds; Admin/Manager can manage any hold. Only Admin/Manager
  complete an already-pending item. Viewer is read-only; inactive users fail closed.
- Tables have RLS; client direct mutations are revoked. Definer implementations
  live in `inventory_private` with fixed empty search paths and explicit execution
  grants. Public RPC wrappers are invoker functions. Daily notice RPC is granted
  only to service role; the existing purge RPC is no longer client-executable.
- Machine completion checks are database-side and serialized per source machine.
  Manual Ready for Disposal cannot bypass unresolved required components. The
  existing archived status carries `archivedStatus=ready_for_disposal`, readiness
  timestamp, archive timestamp, and `purge_after = now() + 30 days`.
- Stock audits survive part deletion using SET NULL. Salvage/history/part links
  are not cascade-deleted with their source machine; snapshots retain useful
  model/serial/identifier information even after source removal.

## Environment, scheduling, deployment

New variable: **`CRON_SECRET`**, server-only. Existing
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and the publishable key
remain in use. No secret values are in these changes.

| Route | UTC schedule | Behavior |
| --- | --- | --- |
| `/api/cron/supabase-keepalive` | `0 6 * * *` | Read one `parts.id`; no mutations/audit noise; timestamped health result. |
| `/api/cron/pending-inventory` | `15 6 * * *` | One consolidated notification per Admin/Manager role per UTC day; empty queues generate none. |

Manual deployment steps: review/apply the new migration after existing migrations,
configure CRON_SECRET in Vercel, then deploy the application only when authorized.
The Vercel root remains `inventory-web`. Confirm both cron jobs and the existing
database retention schedule. The migration must precede the new app because the
inventory snapshot now requires `inventory_availability`.

## Validation and boundaries

Automated PostgreSQL tests use a real custom `inventory_role` enum and separate
connections for concurrent reservations/intake. Browser tests use Chromium at
desktop and iPhone 13 dimensions against this application with mocked API
responses; they are not live production acceptance tests.

Final results: 28 PostgreSQL checks and 12 browser checks passed. `npm run lint`,
`npm run typecheck`, `npm run build`, and `git diff --check` passed. The production
build includes both cron routes and `/pending-inventory`. Phone screenshot review
confirmed the sheet footer remains visible and its form content scrolls.

Coverage includes reservation concurrency, ownership, cancel/fulfill history,
exactly-once fulfillment, stock/archive guards, direct-write rejection, all three
salvage workflows, source plus additional compatibility, PN/NPN validation,
pending-only Manager/Admin intake, consolidated notice deduplication, disposal
guards/automatic archive, 30-day deadlines, source deletion and later NPN intake,
timeline and inventory audit survival, mobile form use, offline reservation
rejection, Viewer controls, cron auth, route smoke checks and model CSV export.

Remaining operational limits:

- No migration or application deployment was performed. Verify live RLS/grants
  and user flows after an authorized migration/deployment; REST schema inspection
  cannot establish the current production function bodies or scheduler state.
- Reservation expiration is intentionally omitted; owners/management cancel
  unused holds. Full offline sync is out of scope; loaded availability is labeled
  unconfirmed until the server accepts a reservation.
- Free-text legacy machine models must match one exact existing model or be linked
  by management before intake. Pull for Use and other noninventory resolutions
  remain available without inventing model/part data.
- Profiles are configurable in SQL; no unrelated template-management UI was added.
- The existing retention scheduler depends on pg_cron being enabled. This iteration
  establishes eligibility and preserves the existing scheduling architecture.
- Existing QR printing, physical label output, full CSV import variations, and all
  legacy role scenarios were not exhaustively exercised against production.
  Browser smoke coverage is not a claim that every legacy behavior was manually tested.
- Dependency installation reported 15 npm advisories. No unrelated dependency
  upgrades or automatic audit fixes were included.

## Git review snapshot

All changes remain unstaged. `git diff --stat` lists tracked changes only;
15 new untracked files are additionally listed in `git status`.

### git diff --stat

```text
 inventory-web/.gitignore                           |   2 +
 inventory-web/MIGRATION_PLAN.md                    |  31 ++
 inventory-web/README.md                            |  73 ++++
 inventory-web/middleware.ts                        |   4 +
 inventory-web/package-lock.json                    | 386 +++++++++++++++++++++
 inventory-web/package.json                         |   5 +
 .../src/components/inventory-provider.tsx          |   2 +
 .../components/pages/green-machine-detail-page.tsx |   5 +
 .../src/components/pages/green-machines-page.tsx   |   4 +-
 .../src/components/pages/inventory-page.tsx        |   5 +-
 inventory-web/src/components/pages/lookup-page.tsx |   3 +-
 .../src/components/pages/model-detail-page.tsx     |   3 +-
 .../src/components/pages/notifications-page.tsx    |   1 +
 .../src/components/pages/part-detail-page.tsx      |  14 +
 inventory-web/src/components/part-editor-sheet.tsx |  93 +++--
 .../src/components/workspace-content-provider.tsx  |  12 +-
 inventory-web/src/lib/admin-health.ts              |   3 +-
 inventory-web/src/lib/app-navigation.ts            |   1 +
 inventory-web/src/lib/green-machine-retention.ts   |   6 +-
 inventory-web/src/lib/inventory-types.ts           |   3 +
 inventory-web/src/lib/inventory-utils.ts           |   4 +
 inventory-web/src/lib/supabase/inventory.ts        |  17 +-
 inventory-web/src/lib/supabase/types.ts            |   2 +-
 inventory-web/src/lib/workspace-content-types.ts   |   2 +
 inventory-web/supabase/phase2_schema.sql           |   4 +
 25 files changed, 638 insertions(+), 47 deletions(-)
```

### git status --untracked-files=all

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   inventory-web/.gitignore
	modified:   inventory-web/MIGRATION_PLAN.md
	modified:   inventory-web/README.md
	modified:   inventory-web/middleware.ts
	modified:   inventory-web/package-lock.json
	modified:   inventory-web/package.json
	modified:   inventory-web/src/components/inventory-provider.tsx
	modified:   inventory-web/src/components/pages/green-machine-detail-page.tsx
	modified:   inventory-web/src/components/pages/green-machines-page.tsx
	modified:   inventory-web/src/components/pages/inventory-page.tsx
	modified:   inventory-web/src/components/pages/lookup-page.tsx
	modified:   inventory-web/src/components/pages/model-detail-page.tsx
	modified:   inventory-web/src/components/pages/notifications-page.tsx
	modified:   inventory-web/src/components/pages/part-detail-page.tsx
	modified:   inventory-web/src/components/part-editor-sheet.tsx
	modified:   inventory-web/src/components/workspace-content-provider.tsx
	modified:   inventory-web/src/lib/admin-health.ts
	modified:   inventory-web/src/lib/app-navigation.ts
	modified:   inventory-web/src/lib/green-machine-retention.ts
	modified:   inventory-web/src/lib/inventory-types.ts
	modified:   inventory-web/src/lib/inventory-utils.ts
	modified:   inventory-web/src/lib/supabase/inventory.ts
	modified:   inventory-web/src/lib/supabase/types.ts
	modified:   inventory-web/src/lib/workspace-content-types.ts
	modified:   inventory-web/supabase/phase2_schema.sql

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	inventory-web/IMPLEMENTATION_REPORT.md
	inventory-web/playwright.config.ts
	inventory-web/src/app/api/cron/pending-inventory/route.ts
	inventory-web/src/app/api/cron/supabase-keepalive/route.ts
	inventory-web/src/app/pending-inventory/page.tsx
	inventory-web/src/components/reservations-panel.tsx
	inventory-web/src/components/salvage-workflow.tsx
	inventory-web/src/components/stock-availability.tsx
	inventory-web/src/lib/cron-auth.ts
	inventory-web/src/lib/inventory-workflows.ts
	inventory-web/supabase/migrations/20260907161719_inventory_reservations_salvage.sql
	inventory-web/tests/browser/workflows.spec.ts
	inventory-web/tests/database-workflows.mjs
	inventory-web/tests/mock-supabase.mjs
	inventory-web/vercel.json

no changes added to commit (use "git add" and/or "git commit -a")
```
