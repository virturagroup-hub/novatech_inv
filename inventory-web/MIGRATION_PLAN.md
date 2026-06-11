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
- Broad print-label buttons were removed from unrelated pages so Reports & Exports remains the main label workflow.
- Scanned routes preserve login return paths through a sanitized internal `next` parameter.
- The edit part experience was widened and broken into clear sections.
- The compatible model picker and location picker were made easier to use on desktop and mobile.
- The reports page now uses simple action cards.
- Printing now uses a dedicated `/print` route with print-only CSS.
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
