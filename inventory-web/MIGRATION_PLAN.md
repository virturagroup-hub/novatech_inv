# Migration Plan

## What Was Found

The original Anything AI Builder project was useful as product reference material, not as the final architecture. It showed the real business intent clearly enough to rebuild around the workflows that matter:

- printer/copier parts inventory
- location/bin tracking
- quantity management
- compatibility with printer/copier models
- label printing
- CSV import/export
- basic activity tracking
- admin-managed user access

The old folder structure was not preserved as the production foundation.

## What Was Rebuilt

The app is now a modern Next.js App Router project inside `inventory-web` with:

- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- a typed local demo inventory store with a Supabase-backed live mode
- responsive desktop and Android-first layouts
- PWA basics for Android installability
- Vercel-ready routes and metadata

The initial implementation now includes:

- dashboard
- inventory table
- dedicated part detail screen
- dedicated part editor screen
- lookup screen
- print label workflow
- locations screen
- models screen
- reports and exports screen
- activity screen
- settings and admin-style views
- Supabase Auth login, logout, and first-login password change flow
- admin user management at `/admin/users`
- real Supabase email/password sign-in for Novatech staff
- admin-only View as Role preview for UI testing without changing real roles

## What Changed In This Pass

- The product was rebranded to Green NVentory with the Novatech logo.
- Role-aware UI helpers were centralized in `src/lib/auth.ts`.
- Elevated users can manage models, locations, parts, labels, exports, and users.
- Technician users can view, look up, adjust stock, and print labels when allowed.
- Viewer users remain read-only.
- Admin-created users are handled server-side through Supabase Auth and the service role key.
- New users are created with `auth.users.app_metadata.must_change_password = true` and are redirected to `/change-password` on first login.
- The change-password flow updates Supabase Auth, clears the auth metadata flag, and leaves the matching profile row unchanged.
- Manager access to users is view-only; admin-only actions stay behind server checks.
- Login now uses real Supabase email/password auth instead of the old demo/temporary login defaults.
- The login flow now blocks missing-profile and inactive accounts with clear user-facing messages.
- Admins can preview viewer, technician, or manager permissions from Settings without mutating their real role.
- A persistent banner appears during role preview so it is clear that the UI is in preview mode only.
- The Users screen is now list-first, with dedicated create/edit routes and explicit reset/deactivate/delete actions in the admin flow.
- Locations and Models are now list-first, with dedicated create/edit routes and archive-first behavior when records are linked.
- The role matrix now matches the requested admin/manager/technician/viewer split, with technician/viewer access tightened on reports, labels, and settings.
- QR label printing now uses clean scan labels instead of report-style cards, with larger QR codes and absolute URLs that land on the part or bin record.
- The label workflow now supports both sheet and thermal layouts, plus per-part copy control for mixed print runs.
- Broad print-label buttons were removed from unrelated pages so Reports & Exports remains the main label workflow.
- Scanned routes preserve login return paths through a sanitized internal `next` parameter.
- The edit part experience was widened and broken into clear sections.
- The compatible model picker and location picker were made easier to use on desktop and mobile.
- Part categories were normalized to a single canonical list, and legacy Supabase part rows now have a cleanup migration.
- The reports page now uses simple action cards.
- Printing now uses a dedicated `/print` route with print-only CSS.
- A support hub, notifications center, and Green Machines workflow were added for technician and floor-team collaboration.
- PWA metadata, icons, and theme color were kept in sync with the new brand.
- Supabase-ready client helpers, table types, CSV import routes, snapshot routes, and schema docs were added without silently mixing demo data with live inventory.
- The Supabase helper layer now includes a middleware session-refresh path and publishable-key support.
- The Next/Turbopack root was pinned to the `inventory-web` project directory so dev no longer resolves Tailwind from the parent folder.
- The Supabase middleware was hardened to fail closed on missing or invalid env vars, and a diagnostic env-presence route was added for safe Vercel troubleshooting.
- The Supabase schema file now reruns safely against older databases by migrating the legacy `profiles.is_active` column to `profiles.active`.

## What Remains For Phase 2

- Move the remaining local demo-only settings persistence into Supabase or a separate preference table if desired.
- Expand validation, row mapping, and error reporting for larger CSV imports.
- Move any remaining browser-only mutation flows into direct Supabase writes where they still exist.
- Add barcode scanning if the crew wants faster on-floor lookup later.
- Consider moving the role preview banner into a dedicated reusable shell component if the UI needs more advanced preview states later.

## Guiding Principle

Phase 2 should finish the Supabase data layer without rewriting the UI or the workflows that are already working well in the current build.
# September 2026: reservations and salvage

Implemented in `20260907161719_inventory_reservations_salvage.sql`; this is an
additive, one-time migration on the existing Supabase architecture. Apply after
the prior three migrations, before deploying the matching application. No
production migration was applied during implementation.

The live REST schema audit confirmed `profiles.role` is `public.inventory_role`,
while the older starter SQL declares text. New authorization helpers use the
actual profile column cast to text without changing the column or enum.

New tables: `inventory_reservations`, `salvage_profiles`,
`salvage_profile_components`, and `machine_salvage_items`. The RLS-aware
`inventory_availability` view returns a consistent On Hand/Reserved/Available
snapshot. Mutation RPCs call private, tightly scoped functions with explicit
active-profile checks. Client direct writes to these tables are revoked.

Existing `workspace_records` remains the machine, timeline, and notification
store. Existing `inventory_transactions` triggers still generate stock audit
entries. Foreign keys use SET NULL plus snapshots to preserve source information
through permanent machine/part deletion. The part audit deletion trigger moves
before deletion so the preserved audit foreign key can be cleared safely.

Admin/Manager can read archived machine records. Completed disposal machines
remain visible to active users so a technician receives a stable completion view.
Clients cannot invoke the existing privileged purge function. Its database cron
schedule remains authoritative. Verify pg_cron configuration separately.

Reservation expiration and full offline synchronization are intentionally outside
this iteration. The online database is authoritative for every reservation and
salvage action. Refer to README and IMPLEMENTATION_REPORT for deployment steps.

## Pre-production audit follow-up

See PREPRODUCTION_AUDIT.md for the authoritative deployment/recovery checklist.
The still-unapplied September migration now requires PostgreSQL 15+, validates
nonnegative physical stock, removes all unintended client table privileges,
captures exact audit rows, and advances part/machine row versions for concurrency.
Ordinary part saves and adjustments use invoker RPCs with existing RLS; narrow
Technician part/compatibility policies align the historical SQL with AGENTS.md.
No model/location/admin privileges were broadened. Unmapped source models use a
durable Service Bin review state with management-only resolution. Legacy active
disposal readiness is reopened with history for checklist review; archived legacy
machines receive a checklist when restored. CSV PN upserts preserve existing IDs.
These are edits to the pending migration, not a second migration to apply afterward.
Never replay phase2_schema.sql or reverse populated tables as an app rollback.
