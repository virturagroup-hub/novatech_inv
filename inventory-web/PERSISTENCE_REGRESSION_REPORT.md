# Workspace persistence regression investigation

Repository: `D:\Novatech Inventory`, `main`, application `inventory-web`.
Baseline commit: `61c95c6d461e4b49ad43ccf09d6e51f078471c92`.
No commit, push, deployment, or remote database write was performed for this fix.

## Root cause and evidence

The existing Green Machine Delete action is a **soft delete** with a 30-day
retention deadline. It does not immediately delete the machine or its history.

Before the fix, the chain was:

1. Detail/roster Delete called `deleteGreenMachine` in
   `src/components/workspace-content-provider.tsx`.
2. The provider immediately set React `status: archived` and `deletedAt`, then
   called `archiveWorkspaceRecord` without awaiting confirmation in the UI.
3. `src/lib/supabase/workspace-content.ts` sent a PATCH to `workspace_records`
   setting `deleted_at`, `deleted_by`, `purge_after`, and `updated_by`. It did not
   change `payload.status`. Errors were caught and only logged; zero affected
   rows were not checked.
4. On reload, `fetchWorkspaceContentState` selected rows visible under RLS.
   Admin and Manager can read retained machine rows. `payloadWithLifecycle`
   copied the lifecycle timestamps but retained the old JSON `status: active`.
5. The machine roster rendered the returned collection and counted activity by
   JSON status, displaying the soft-deleted machine again.

A read-only inspection of the configured Supabase database found one machine row:
one soft-deleted, with a purge deadline, and with JSON status still `active`.
The original deletion **did reach Supabase**. No row repair was performed.

The new browser regression first failed on the original application after
create → server confirmation → UI delete → reload: expected zero matching
machine names, received one. Tests use the actual Next.js application and a
persistent local HTTP fixture. The fixture preserves the stale JSON/column
mismatch; it is not a replacement application or a production database.

## Persistence changes

- Lifecycle columns govern loaded machine/thread status. The database row ID
  also overrides an inconsistent JSON ID.
- Deleted machines are excluded from the roster and entity lookup. Archived
  machines, including automatically archived disposal machines, have a separate
  existing-roster view. A purge deadline alone keeps a machine inactive.
- Retained FAQ, SOP, release-note, coming-soon, post and vote rows are excluded
  from their active/editable collections. Retained threads and notification
  receipts retain their dedicated history semantics.
- Shared mutations await the database error and exact affected-row count.
  Zero-row RLS responses fail visibly. Live local state is replaced with a fresh
  server read, including any database-triggered changes; local reducers are
  reserved for demo mode.
- UI handlers await success before closing/resetting forms, navigating away, or
  showing success. Failures reload authoritative state. A committed write whose
  subsequent read fails is explicitly reported as saved with a reload failure.
- Create uses INSERT. Existing edits use UPDATE with active-lifecycle predicates.
  Explicit restore uses UPDATE against the existing ID. Neither can reinsert a
  permanently deleted record. Caller-generated new FAQ/update IDs explicitly
  identify create versus update.
- Load generation numbers prevent an older hydration result from overwriting
  newer mutation reads. Load failures show a retry message. An empty successful
  collection remains an empty collection.
- Notification read/archive/delete/restore actions verify their per-user receipt
  writes. Bulk read processes the current user's visible inbox.
- Delete confirmation text now explains the existing retention behavior rather
  than claiming immediate permanent removal of the timeline.

## RLS, schema and retention audit

No schema migration, RLS change, new privilege, cron change, environment variable,
or remote SQL is needed for this fix. The existing September migration is unchanged.

Real isolated PostgreSQL tests reconstruct all checked-in migrations, including
the custom `inventory_role` enum. Admin and Manager machine deletes affect one
row and persist lifecycle columns. Technician and Viewer machine updates affect
zero rows. Admin/Manager retained-machine read access is intentional; the client
must honor lifecycle columns when interpreting those rows.

Other content-management delete controls and thread archive/delete controls are
Admin-only. Manager attempts on those retained rows are rejected by existing
read-policy checks. That boundary is preserved; the client now reports failures.
Managers retain their existing active-thread moderation capabilities.

The existing purge function/scheduler remains responsible for permanent deletion.
No keepalive change or deletion job was introduced. Salvage events, checklist
snapshots, Pending Inventory lineage and inventory history are retained by the
existing architecture. The adapter dispatches entities only from their record
type, never from an event or historical source-machine snapshot.

## Demo, storage and service worker audit

The prior seed fix has not regressed. Live boot reads Supabase directly, without
merging seed arrays. Default live state is empty. Demo hydration uses
`Array.isArray`, preserving intentionally empty arrays. Workspace localStorage
is read and written only in development demo mode. Production cannot enable
demo data through `NEXT_PUBLIC_ENABLE_DEMO_DATA`.

`public/sw.js` excludes cross-origin requests and non-GET requests. It caches
the application shell/assets, not Supabase workspace REST data. It does not
reconstruct entities from cached history. No service-worker change is needed.

## Validation

Final application validation completed September 9, 2026:

| Command | Result |
| --- | --- |
| `npm run test:db` | 130 PostgreSQL checks completed; disposable database stopped |
| `npm run test:persistence` | 32 adapter checks passed |
| `npm run test:browser` | 46 passed: 23 desktop and 23 phone; 26 new persistence cases plus 20 existing workflow cases |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; 36 static-generation entries completed; existing edge-runtime informational warning |
| `npm run test:security` | Passed; cron authorization/configuration checks and 56 production client bundles scanned |
| `git diff --check` | Passed; Git reports only configured LF-to-CRLF conversion notices |

The new browser cases cover machine create/delete/reload/clean second session,
403 and zero-row deletion failures, archive/restore, an empty server with orphaned
history and stale localStorage, Technician/Viewer controls, FAQ/update/coming-soon
deletion from management lists, failed creation preserving the form, unavailable
data with Retry, and new-versus-existing changelog writes. Each runs on desktop
and phone. The initial regression failed on the original code before the fix.

The adapter tests cover all managed content collections, thread lifecycle
normalization, notification receipts, stale edits, missing-row restore, and empty
hydration. PostgreSQL tests cover real RLS for all four roles, retained machine
visibility, lifecycle row counts, missing-row updates, and all prior reservation,
salvage, audit and purge checks. The database harness now selects an available
local port and fails if the suite exits before completion, avoiding false success
when a fixed test port is occupied.

## Files changed

All paths are relative to `D:\Novatech Inventory\inventory-web`.

| File | Change |
| --- | --- |
| `src/lib/supabase/workspace-content.ts` | Authoritative lifecycle hydration, exact row-count validation, guarded edit/restore |
| `src/components/workspace-content-provider.tsx` | Confirmed writes, server refresh, session-aware loading, errors/retry, lifecycle filtering |
| `src/components/pages/green-machines-page.tsx` | Await actions, active/archive views, accurate retention wording/loading |
| `src/components/pages/green-machine-detail-page.tsx` | Await save/archive/delete, accurate retention wording |
| `src/components/pages/support-page.tsx` | Await FAQ/thread operations; explicit new FAQ insert |
| `src/components/pages/updates-page.tsx` | Await content operations; explicit insert versus edit |
| `src/components/pages/forum-page.tsx` | Await thread/reply/status operations |
| `src/components/pages/feature-requests-page.tsx` | Await thread/reply/status operations |
| `src/components/pages/notifications-page.tsx` | Await receipt lifecycle changes |
| `tests/mock-supabase.mjs` | Persistent transport rows/receipts, affected counts and failure injection |
| `tests/database-workflows.mjs` | Real persistence/RLS regressions and reliable isolated startup |
| `tests/browser/workspace-persistence.spec.ts` (new) | Actual application persistence regressions |
| `tests/workspace-persistence.mjs` (new) | Actual Supabase adapter over isolated HTTP |
| `package.json` | Add `test:persistence` command |
| `README.md` | Persistence behavior and validation instructions |
| `MIGRATION_PLAN.md` | Root cause and unchanged SQL/RLS boundaries |
| `PERSISTENCE_REGRESSION_REPORT.md` (new) | This investigation and validation record |

## Remaining deployment/review steps

Review the working-tree changes before committing or deploying. This fix requires
no new SQL. Any earlier unapplied inventory migration remains a separate manual
deployment prerequisite. After an approved code deployment, refresh both test
browsers and confirm that the already-soft-deleted machine is absent; no data
repair is needed for that row.

Live production mutations were not used for testing. Browser/adapter tests use
local transport fixtures; actual authorization, triggers and retention behavior
are tested separately in disposable PostgreSQL. The app does not add realtime
cross-browser subscriptions; another already-open session sees changes on its
next authoritative refresh. Archived records must be restored before editing.
Secondary workspace notifications remain separate writes from their originating
content action; a notification failure is reported without claiming that the
already-saved content was rolled back.

## Final Git state

`git diff --stat` (tracked files only; three new files remain untracked):

```text
 inventory-web/MIGRATION_PLAN.md                    |  17 +
 inventory-web/README.md                            |  25 +-
 inventory-web/package.json                         |   1 +
 .../src/components/pages/feature-requests-page.tsx |  15 +-
 inventory-web/src/components/pages/forum-page.tsx  |  15 +-
 .../components/pages/green-machine-detail-page.tsx |  16 +-
 .../src/components/pages/green-machines-page.tsx   |  31 +-
 .../src/components/pages/notifications-page.tsx    |   8 +-
 .../src/components/pages/support-page.tsx          |  25 +-
 .../src/components/pages/updates-page.tsx          |  20 +-
 .../src/components/workspace-content-provider.tsx  | 399 +++++++++++----------
 .../src/lib/supabase/workspace-content.ts          |  42 ++-
 inventory-web/tests/database-workflows.mjs         |  42 ++-
 inventory-web/tests/mock-supabase.mjs              |  53 ++-
 14 files changed, 430 insertions(+), 279 deletions(-)
```

`git status --untracked-files=all`:

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   inventory-web/MIGRATION_PLAN.md
	modified:   inventory-web/README.md
	modified:   inventory-web/package.json
	modified:   inventory-web/src/components/pages/feature-requests-page.tsx
	modified:   inventory-web/src/components/pages/forum-page.tsx
	modified:   inventory-web/src/components/pages/green-machine-detail-page.tsx
	modified:   inventory-web/src/components/pages/green-machines-page.tsx
	modified:   inventory-web/src/components/pages/notifications-page.tsx
	modified:   inventory-web/src/components/pages/support-page.tsx
	modified:   inventory-web/src/components/pages/updates-page.tsx
	modified:   inventory-web/src/components/workspace-content-provider.tsx
	modified:   inventory-web/src/lib/supabase/workspace-content.ts
	modified:   inventory-web/tests/database-workflows.mjs
	modified:   inventory-web/tests/mock-supabase.mjs

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	inventory-web/PERSISTENCE_REGRESSION_REPORT.md
	inventory-web/tests/browser/workspace-persistence.spec.ts
	inventory-web/tests/workspace-persistence.mjs

no changes added to commit (use "git add" and/or "git commit -a")
```
