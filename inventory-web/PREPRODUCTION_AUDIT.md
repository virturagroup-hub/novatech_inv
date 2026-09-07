# Pre-production inventory audit

Repository: `https://github.com/virturagroup-hub/novatech_inv.git`, branch `main`,
application `D:\Novatech Inventory\inventory-web`. This audits and fixes the actual
working tree and checked-in SQL. No commit, push, merge, production SQL execution,
or deployment was performed. The September migration is still unapplied and its
fixes are incorporated into that file, not a competing second migration.

## Audit findings

### Critical

None identified in the reviewed code. This is not certification of uninspected
live PostgreSQL policies, privileges, function bodies or scheduler configuration.

### High — fixed locally

1. New tables revoked DML but inherited Supabase-style default grants could retain
   TRUNCATE, REFERENCES and TRIGGER. RLS does not protect TRUNCATE. Revoked all
   privileges from PUBLIC/anon/authenticated, then granted SELECT only on new
   workflow tables. Also revoked app TRUNCATE on parts, audit and workspace tables.
   This is a database-privilege defect; ordinary PostgREST does not expose a
   TRUNCATE endpoint. Service-role/database-owner recovery remains privileged.
2. Stock guards covered UPDATE/DELETE but not negative INSERT. Added a validated
   nonnegative CHECK. Holds now block isolated purge-date changes as well as
   archive, soft deletion and hard deletion. Inactive/purge-scheduled parts cannot
   receive new reservations or salvage intake.
3. SELECT FOR UPDATE alone did not advance the part version. A pre-existing
   REPEATABLE READ transaction could overlook a later reservation. Reservation
   creation now writes the part row version; stale writers fail serialization.
   Machine actions likewise advance the source row version to serialize completion.
4. Old quantity controls used cached absolute totals. Add Part swallowed errors,
   wrote stock and compatibility in separate requests, and could report success
   on failure. Added atomic invoker save/adjust RPCs, stale-edit detection, and
   awaited UI saves. Direct updates/imports still encounter the same stock guard.
5. CSV PN upserts generated replacement UUIDs for existing parts, conflicting with
   historical/reservation/model-link foreign keys. They now preserve existing IDs.

### Medium — fixed locally

1. Audit attachment used transaction `xmin`, potentially rewriting multiple earlier
   stock events or missing subtransaction events. A private trigger captures the
   exact inserted audit UUID; each RPC clears the capture before its stock write
   and annotates only that row. Existing stock audit triggers remain authoritative.
2. Cron middleware bypass used a prefix. A shared exact allowlist now contains only
   the two intended routes. Endpoint authorization still runs before admin-client
   creation and denies missing configuration or incorrect Bearer credentials.
3. Unmapped models previously produced only a toast and blocked Save Later. The
   existing sheet now records PN/NPN, additional compatibility and the unchanged
   source snapshot in the shared Service Bin with `modelResolutionRequired`.
   A persistent explanation and management model-selection control provide a
   resolution path. Canonical inventory intake remains blocked until resolved.
4. Legacy archives lacked checklists and could fail the new disposal guard on
   restore. Restore now uses one awaited upsert. Legacy restoration opens as Active
   and seeds a checklist. Active legacy Ready for Disposal machines are reopened
   for checklist review with a history entry preserving their previous snapshot.
   Existing archived machines stay archived; completed tracked checklists survive.
5. Historical SQL denied technician part writes despite the repository role rules
   and UI explicitly permitting them. Added narrow technician INSERT/UPDATE/DELETE
   policies on parts and a compatibility-link write policy. `is_elevated_user`
   remains unchanged, so models, locations and administration are not broadened.

### Low / informational

- `inventory_availability` already used the correct `security_invoker=true` option.
  Added a PostgreSQL 15+ preflight and actual role/RLS tests instead of relying on
  the view owner's behavior. Live server version was not established by REST.
- Added indexes for reservation history and salvage source/part FK cleanup.
- Added accessible names to the existing full-page PN, NPN and part-name controls.
- `phase2_schema.sql` changes are four leading documentation lines only. It remains
  the historical bootstrap, followed by chronological migrations for fresh installs;
  it is not a production upgrade script and does not change the live enum.
- The existing purge function is scheduled only if pg_cron was already present
  when the July retention migration ran. This is an operational deployment check.

## Fix locations and validation

| Files | Solution | Validation |
| --- | --- | --- |
| `supabase/migrations/20260907161719_inventory_reservations_salvage.sql` | Privileges, nonnegative stock, locks/version changes, exact audit capture, invoker part RPCs, narrow technician policies, model review, legacy lifecycle, FK indexes | Real PostgreSQL enum/RLS/privilege/concurrency/retry/purge tests |
| `src/components/inventory-provider.tsx`, `pages/part-editor-page.tsx`, `part-editor-sheet.tsx`, `pages/inventory-page.tsx` | Database stock deltas, atomic saves, stale-form checks, confirmed save/delete feedback | DB stale-edit/FK rollback and browser failure/edit/adjust cases |
| `src/components/pages/green-machine-detail-page.tsx` | Legacy transfer passes a stock delta and uses returned part ID | Shared save RPC tests and code review; legacy event remains a separate request |
| `src/lib/supabase/inventory.ts` | CSV preserves existing part UUID | Browser invokes actual import API and inspects write; DB ON CONFLICT hold rejection |
| `src/components/salvage-workflow.tsx`, `src/lib/inventory-workflows.ts` | Persistent unmapped-model queue, management resolution, retained source text | Phone/desktop removal-to-review-to-intake; DB post-purge model resolution |
| `src/components/workspace-content-provider.tsx`, `pages/green-machines-page.tsx` | One awaited restore write, server state refresh, no false-success toast | Real legacy UPSERT restore, lifecycle inspection |
| `middleware.ts`, `src/lib/cron-paths.ts`, `tests/security-checks.mjs` | Exact route bypass, actual auth-helper tests, production client bundle scan | Missing/invalid/valid secret and route cases; browser read-only keepalive |
| `tests/database-workflows.mjs`, `tests/browser/workflows.spec.ts`, `tests/mock-supabase.mjs`, `package.json` | Expanded isolated regression tests | Commands/results below |
| `README.md`, `MIGRATION_PLAN.md`, `IMPLEMENTATION_REPORT.md`, this report | Current workflow, deployment and recovery guidance | Reviewed against actual SQL/routes |

## Database safety

**RLS and view.** Each Admin, Manager, Technician and Viewer test uses a real
authenticated-role connection and its own auth UID. View results are compared
against underlying parts results, including archived inventory and an additional
restrictive policy that even the view owner would bypass. Anon is denied view
access. Active profiles can read shared workflow history; direct workflow table
writes are unavailable. Existing part read policies remain in place; new technician
part write policies do not add SELECT access to archived parts.

**Functions.** New privileged implementations live in `inventory_private`, with
empty search paths, qualified `public`/`auth`/`inventory_private` relations/functions
and pg_catalog built-ins. Migration DDL sets search_path to pg_catalog. Public RPC
wrappers are SECURITY INVOKER. Ordinary part save/adjust implementations are also
INVOKER and therefore use RLS. Private authorization/mutation triggers and guarded
reservation/salvage implementations are DEFINER. Only the guarded entry points have
authenticated EXECUTE; trigger helpers do not. Schema CREATE is not granted to
app users. Daily notice and purge execution belong to service_role/database jobs.
Role checks use the actual `profiles.role::text`; no enum is recreated or converted.

**Stock.** A nonnegative CHECK plus a row trigger enforces On Hand >= active holds.
The availability view calculates On Hand minus active holds in one snapshot.
Reservation creation locks/versions the part; resolution locks part then hold;
salvage locks source machine then checklist and uses PN advisory/part locks for
intake. Retry IDs and terminal states prevent repeat deduction/intake/cancellation.
READ COMMITTED and a stale REPEATABLE READ writer are exercised. Database-owner or
service-role direct writes to protected workflow tables are recovery operations;
they are not ordinary client APIs and must deliberately reconcile reservations.

**Write-path inventory.** Provider Add/Edit and adjustments now use transactional
RPCs. Legacy transfer uses the same save RPC and an additive delta. CSV uses its
existing batched parts UPSERT, with stable existing IDs. Manual quantity updates,
all RPC stock updates, archive/delete/purge and legacy direct Supabase mutations
hit the same table CHECK/trigger. CSV model/location/link stages remain separate
requests: this audit does not claim whole-file import atomicity. Explicit absolute
CSV counts remain management reconciliation inputs, so serialize bulk imports
with warehouse counting rather than treating them as incremental stock movements.

**Lifecycle and lineage.** Pull for Use resolves/remembers actor/time/source without
stock. Intake creates or increments stock, adds source plus extra model links and
resolves in one transaction. Failure rolls back stock, links, audit and checklist.
Pending Inventory stores the draft, resolves removal and never blocks disposal.
The final required component writes Ready for Disposal history, two role-targeted
notices and archive/purge timestamps atomically. `purge_after - archived_at` tests
equal 30 days. Notices contain original model, serial, machine ID and readiness
time; snapshot JSON and actor labels survive FK cleanup. Optional unresolved
components do not block completion, per the required-component rule.

Machine references use SET NULL; original source ID/snapshot remain. Stock audit
part references now use SET NULL and the deletion audit fires BEFORE DELETE.
Salvaged inventory, pending/completed rows and timeline events survive actual
source deletion. Completed reservation history likewise remains. Historical
records independently marked for expiry still obey their own retention dates.

## Existing purge mechanism

Checked `20260725123000_workspace_content_retention.sql` directly:

- Job name: `purge-retained-records`.
- Schedule: `15 2 * * *`, daily at 02:15 in the database cron timezone. Confirm
  `cron.timezone` is UTC in production (pg_cron normally defaults to GMT/UTC).
- Command: `select public.purge_expired_retained_records();`.
- The SECURITY DEFINER function deletes expired `workspace_records`,
  `workspace_notification_receipts`, `parts`, `locations`, then `models`, using
  `purge_after is not null and purge_after <= now()`.
- The July migration conditionally calls named `cron.schedule` when pg_cron is
  installed. The September migration preserves the function/job and restricts
  client execution; it does not enable the extension or create another purge job.
- If pg_cron was absent, no job is created. Records remain archived beyond their
  deadline until an authorized scheduler invokes the function. Neither Vercel job
  deletes records, and no browser must be open for configured database retention.
- Manual requirement: enable Supabase Cron if needed and create/verify this named
  job as the database owner. If enabling it after the July migration, schedule the
  existing function directly; do not replay the entire old migration. Confirm
  `cron.job.active`, timezone, command, and successful `cron.job_run_details`.
- Local tests invoke the actual checked-in purge as service_role against expired
  machines and parts. Pending intake, inventory audit and lineage survive;
  unexpired records remain. pg_cron itself is not installed in the isolated test
  cluster, so scheduler execution is a manual production verification.

## Exact recommended production sequence

1. Review the working tree and authorize a release separately. Confirm Supabase
   project/Vercel association and root `inventory-web`. Record the current deployed
   build and migration ledger. Ensure recoverable database backup/PITR; securely
   export schema/RLS/functions/grants and parts, links, audit, workspace/receipts.
2. Preflight live metadata and data: PostgreSQL >=15; actual inventory_role values;
   the three prerequisite migrations; actual profile/parts/workspace types and RLS;
   stock counts are nonnegative; expected audit/retention triggers and FK names;
   no independently created object collides with the new tables/functions/view.
   Review active legacy Ready for Disposal machines that will be reopened. Check
   existing purge job/backlog and avoid the purge window during release.
3. Configure a strong server-only `CRON_SECRET` in the Vercel Production environment
   before the new deployment. Preserve server-only `SUPABASE_SERVICE_ROLE_KEY`,
   public Supabase URL/publishable key, and existing `NEXT_PUBLIC_APP_URL` for QR
   destinations. Do not give secrets a NEXT_PUBLIC prefix. Configuration alone
   does not make the new cron code available.
4. Arrange a short inventory-write maintenance interval: finish in-flight old
   clients/imports and avoid overlapping destructive retention work. Apply only
   `20260907161719_inventory_reservations_salvage.sql` after its three prerequisites,
   with the owner/migration role. It is transactional: validation/DDL failure
   aborts the migration; resolve the cause rather than partially replaying SQL.
5. Before app rollout, verify view `reloptions`, CHECK/trigger presence, new tables,
   policies, privileges, invoker/definer/search_path definitions, RPC signatures,
   FK SET NULL behavior and checklist backfill. Confirm PostgREST schema cache
   sees the RPCs (reload it through the normal Supabase mechanism if necessary).
   Rehearse role-based checks on a safe approved test dataset, not real final units.
6. Deploy the matching Vercel app only after explicit authorization. Confirm the
   production domain serves it and old tabs are refreshed before writes resume.
   Vercel reads `inventory-web/vercel.json` with this project root.
7. Verify cron endpoints: no/wrong auth =>401; authorized keepalive =>200 with a
   lightweight read; authorized pending notice =>200 and one aggregate notice per
   management role/day only when nonempty. Check configured production cron jobs:
   keepalive `0 6 * * *`, Pending Inventory `15 6 * * *`, both UTC. Vercel plan timing
   can be approximate; these workflows do not depend on exact-minute execution.
8. Verify/enable the existing database purge job as described above, reviewing the
   expired-record backlog before enabling deletion. Verify observed successful job
   runs; do not call purge casually as a harmless health check.
9. Perform approved production smoke checks as Admin/Manager/Technician/Viewer:
   Add/Edit/adjust, reserve/cancel/fulfill, PN/NPN/source models, all salvage paths,
   Pending Inventory/review, notices, archive/restore, lookup/model detail/CSV/QR
   and mobile sheets. Resume normal writes once verified and monitor errors.

**Old application between migration and deployment:** original table/column names
and APIs remain; ordinary nonnegative stock reads/writes are schema-compatible.
The migration changes behavioral guards, technician policies, audit FK deletion
and legacy readiness, so compatibility is not a claim of identical behavior. Old
clients do not display active reservations, cannot complete the new checklist and
may swallow write errors. Keep the write interval short and do not let old tabs
continue operating after users start new reservations/salvage. New app before
migration is unsafe: its snapshot requires `inventory_availability` and new RPCs.

## Recovery without destructive rollback

If the application fails after migration, prefer disabling new entry points or
serving read-only/maintenance UI while deploying an application fix. A previous
build may provide basic reads, but it must not be treated as reservation-aware.
Pause the affected Vercel cron if it repeatedly fails; keep deliberate retention
controls under the database owner. An unavailable UI does not justify canceling
valid holds or deleting pending work.

Tables/view/helpers and indexes are additions; CHECKs, RLS/grants, stock/deletion
triggers and audit FK behavior also changed. Do NOT drop populated reservation or
salvage tables, remove stock guards, reset lifecycle timestamps, recreate the old
cascading audit FK, or replay the starter schema as a rollback. Export new tables,
workspace events/notices and audit history before any corrective database work.
Use a reviewed forward migration after reconciling holds and physical inventory.
Whole-database PITR/restore requires an explicit incident decision and reconciliation
of writes made after the backup; no destructive rollback script was created.

## Validation results

Final commands/results are recorded after the last audit fixes. Database tests use
an isolated real PostgreSQL cluster with `inventory_role`, role-specific sessions
and Supabase-style default grants. Browser tests run the existing app against
test-only transport fixtures; they are not live Supabase acceptance tests.

| Command | Final result |
| --- | --- |
| `npm run test:db` | PASS — 93 checks; actual migrations, enum roles, races, RLS and purge |
| `npm run test:browser` | PASS — 20 tests across desktop and iPhone-sized Chromium |
| `npm run lint` | PASS — no errors/warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next.js 16.2.6; 36 static pages generated; new routes included |
| `npm run test:security` | PASS — actual auth helper/allowlist/schedules and 56 production client bundles |
| `git diff --check` | PASS — no whitespace errors; Git emitted normal Windows LF/CRLF notices |

The browser run includes Add Part rejected-save retention, Edit Part, adjustment,
CSV identity, source/NPN intake, management model review, lookup/model detail,
QR label rendering, Viewer controls and both cron routes. The phone screenshot
was inspected: form content scrolls and the Service Bin save footer is visible.
No production browser/database acceptance test or physical printer test is implied.
During test development, selectors were corrected to the existing full-page Add
Part route/accessibility controls and visible mobile results. The auth test also
accounts for standard HTTP Headers trimming outer whitespace; internal malformed
Bearer spacing remains rejected. No security checks were bypassed to pass tests.

## Remaining risks and manual requirements

- Live PostgreSQL version, migration ledger, grants/RLS drift, cron enablement and
  job history were not established by repository tests. They require the preflight
  above; the migration fails closed on unsupported PostgreSQL or negative stock.
- The validated CHECK/backfill/FK changes take locks and scale with existing rows.
  Use the maintenance interval and an appropriate owner-side lock/statement timeout.
- The existing CSV importer remains multi-request; metadata may be created before
  a stock-stage failure. A concurrent new PN can cause a safe conflict; retry only
  after reviewing results. Ordinary Add/adjust and legacy transfer are not request-ID
  idempotent under ambiguous network outcomes. Inspect history before retrying;
  new reservation and tracked salvage operations have explicit retry protection.
- Legacy free-form machine transfer still saves stock and its event separately.
  New checklist intake is atomic and is the intended tracked salvage path. Old
  free-form events never automatically resolve checklist entries.
- Physical label printing/scanning and every import variation were not exercised
  with production hardware/data. QR rendering and existing routes/export/search
  receive local regression coverage; full production smoke tests remain manual.
- Purge ownership is deliberately privileged. Do not expose its service credentials
  or grant direct workflow mutation rights to app roles. RPC/helper schema grants
  must be rechecked if Supabase defaults or exposed schemas are customized.
- Existing dependency advisories and Next middleware deprecation are not remediated
  through unrelated upgrades/refactors in this inventory iteration.

## References

- [PostgreSQL 15 CREATE VIEW](https://www.postgresql.org/docs/15/sql-createview.html):
  security_invoker uses caller permissions/RLS for underlying relations.
- [PostgreSQL schemas/search paths](https://www.postgresql.org/docs/15/ddl-schemas.html):
  pg_catalog is implicitly searched when not explicitly listed.
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs):
  CRON_SECRET Bearer authorization and operational management.
- [Vercel cron configuration](https://vercel.com/docs/cron-jobs): UTC cron expressions.

## Git review

All changes are unstaged. The final response includes the exact tracked diff stat
and full untracked-file status. The stat excludes untracked migration/components/
tests/reports, which must also be included in the eventual authorized commit.

### git diff --stat

```text
 inventory-web/.gitignore                           |   2 +
 inventory-web/MIGRATION_PLAN.md                    |  46 +++
 inventory-web/README.md                            |  87 +++++
 inventory-web/middleware.ts                        |   5 +
 inventory-web/package-lock.json                    | 386 +++++++++++++++++++++
 inventory-web/package.json                         |   6 +
 .../src/components/inventory-provider.tsx          |  99 ++----
 .../components/pages/green-machine-detail-page.tsx |  11 +-
 .../src/components/pages/green-machines-page.tsx   |   9 +-
 .../src/components/pages/inventory-page.tsx        |  11 +-
 inventory-web/src/components/pages/lookup-page.tsx |   3 +-
 .../src/components/pages/model-detail-page.tsx     |   3 +-
 .../src/components/pages/notifications-page.tsx    |   1 +
 .../src/components/pages/part-detail-page.tsx      |  14 +
 .../src/components/pages/part-editor-page.tsx      |  23 +-
 inventory-web/src/components/part-editor-sheet.tsx |  95 +++--
 .../src/components/workspace-content-provider.tsx  |  67 ++--
 inventory-web/src/lib/admin-health.ts              |   3 +-
 inventory-web/src/lib/app-navigation.ts            |   1 +
 inventory-web/src/lib/green-machine-retention.ts   |   6 +-
 inventory-web/src/lib/inventory-types.ts           |   5 +
 inventory-web/src/lib/inventory-utils.ts           |   4 +
 inventory-web/src/lib/supabase/inventory.ts        |  21 +-
 inventory-web/src/lib/supabase/types.ts            |   2 +-
 inventory-web/src/lib/workspace-content-types.ts   |   2 +
 inventory-web/supabase/phase2_schema.sql           |   4 +
 26 files changed, 754 insertions(+), 162 deletions(-)
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
	modified:   inventory-web/src/components/pages/part-editor-page.tsx
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
	inventory-web/PREPRODUCTION_AUDIT.md
	inventory-web/playwright.config.ts
	inventory-web/src/app/api/cron/pending-inventory/route.ts
	inventory-web/src/app/api/cron/supabase-keepalive/route.ts
	inventory-web/src/app/pending-inventory/page.tsx
	inventory-web/src/components/reservations-panel.tsx
	inventory-web/src/components/salvage-workflow.tsx
	inventory-web/src/components/stock-availability.tsx
	inventory-web/src/lib/cron-auth.ts
	inventory-web/src/lib/cron-paths.ts
	inventory-web/src/lib/inventory-workflows.ts
	inventory-web/supabase/migrations/20260907161719_inventory_reservations_salvage.sql
	inventory-web/tests/browser/workflows.spec.ts
	inventory-web/tests/database-workflows.mjs
	inventory-web/tests/mock-supabase.mjs
	inventory-web/tests/security-checks.mjs
	inventory-web/vercel.json

no changes added to commit (use "git add" and/or "git commit -a")
```
