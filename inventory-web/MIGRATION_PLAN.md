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
- a typed Phase 1 local inventory store
- responsive desktop and Android-first layouts
- PWA basics for Android installability
- Vercel-ready routes and metadata

The Phase 1 implementation now includes:

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

## What Changed In This Pass

- The product was rebranded to Green NVentory with the Novatech logo.
- Role-aware UI helpers were centralized in `src/lib/auth.ts`.
- Elevated users can manage models, locations, parts, labels, exports, and users.
- Technician users can view, look up, adjust stock, and print labels when allowed.
- Viewer users remain read-only.
- Admin-created users are handled server-side through Supabase Auth and the service role key.
- New users are created with `must_change_password = true` and are redirected to `/change-password` on first login.
- The change-password flow updates both Supabase Auth and the matching profile row.
- Manager access to users is view-only; admin-only actions stay behind server checks.
- The edit part experience was widened and broken into clear sections.
- The compatible model picker and location picker were made easier to use on desktop and mobile.
- The reports page now uses simple action cards.
- Printing now uses a dedicated `/print` route with print-only CSS.
- PWA metadata, icons, and theme color were kept in sync with the new brand.
- Supabase-ready client helpers, table types, and schema docs were added without replacing the Phase 1 store.
- The Supabase helper layer now includes a middleware session-refresh path and publishable-key support.
- The Next/Turbopack root was pinned to the `inventory-web` project directory so dev no longer resolves Tailwind from the parent folder.
- The Supabase middleware was hardened to fail closed on missing or invalid env vars, and a diagnostic env-presence route was added for safe Vercel troubleshooting.
- The Supabase schema file now reruns safely against older databases by migrating the legacy `profiles.is_active` column to `profiles.active`.

## What Remains For Phase 2

- Replace browser-local persistence with Supabase/Postgres.
- Move inventory CRUD into real Supabase tables.
- Move audit logging into the `inventory_transactions` table.
- Wire server-side data fetching and mutation into the new Supabase helpers.
- Expand validation and import processing on the server.
- Add barcode scanning if the crew wants faster on-floor lookup later.

## Guiding Principle

Phase 2 should swap the data layer without rewriting the UI or the workflows that are already working well in Phase 1.
