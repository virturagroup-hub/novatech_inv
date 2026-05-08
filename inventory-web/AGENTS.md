# Project Standards

This repository is the Green NVentory rebuild for Novatech's green and reusable printer/copier parts inventory. Future Codex work should keep the app maintainable, mobile-friendly, and ready for the remaining Supabase migration work.

## Architecture Rules

- Use Next.js App Router patterns.
- Keep route files in `src/app` and route-level client components in `src/components/pages`.
- Preserve the typed mock-data layer until Phase 2 explicitly replaces it.
- Keep inventory state flows in `src/lib` reducers and helpers rather than scattering logic across pages.
- Keep role logic centralized in `src/lib/auth.ts`.
- Use `src/lib/supabase` for Supabase client, server, middleware, profile, and type helpers.
- Do not let client components import server-only helpers that depend on `next/headers`.

## Data Rules

- Treat the browser-local store as Phase 1 only.
- Do not connect Supabase unless the app is already stable and the migration is explicitly in scope.
- Keep inventory, bin, model, profile, and transaction shapes typed and reusable.
- Update the seed data and migration notes when the structure changes.
- Use `profiles.role`, `profiles.active`, and `profiles.must_change_password` as the source of truth once Supabase is live.

## Auth and User-Management Rules

- Supabase Auth is the source of truth for login.
- Public signups stay disabled.
- Admins create users from `/admin/users`.
- User creation must stay server-side only.
- Only server routes or server actions may use `SUPABASE_SERVICE_ROLE_KEY`.
- Never expose the service role key to client components.
- Admins may create and edit users, set roles, deactivate users, and force password changes.
- Managers may view the roster if allowed, but they must not create admin users.
- Technician and viewer users must not access `/admin/users`.
- If `profiles.must_change_password` is true, the app must redirect to `/change-password`.
- The change-password flow must clear `must_change_password` after a successful password update.

## UI Rules

- Prefer reusable primitives such as `Button`, `Card`, `Badge`, `Input`, `Select`, `Tabs`, `Table`, `Sheet`, and `AlertDialog`.
- Use `buttonVariants` for link-as-button patterns instead of fragile wrapper hacks.
- Keep mobile navigation simple and touch-friendly.
- Preserve the PWA basics: manifest, icons, theme color, and the safe service worker registration.
- Use the dedicated `/print` route for labels; do not reintroduce page-wide `window.print()` flows.
- Keep the print layout strictly label-only with no app chrome.

## Permission Rules

- Use the centralized helpers in `src/lib/auth.ts`:
  - `canManageParts`
  - `canManageModels`
  - `canManageLocations`
  - `canAdjustStock`
  - `canPrintLabels`
  - `canExportReports`
  - `canViewActivity`
  - `canViewUsers`
  - `canManageUsers`
- Admin and manager users are elevated.
- Viewer users are read-only.
- Technician users can view, look up, adjust stock if allowed, and print labels if allowed.
- Do not scatter role checks directly through components when a helper will do.

## Workflow Rules

- Use `apply_patch` for manual file edits.
- Avoid destructive git commands.
- Do not revert user changes unless explicitly asked.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` before finishing.
- Update `README.md` and `MIGRATION_PLAN.md` when the app structure or workflow changes.
- Keep the Supabase schema notes in `supabase/phase2_schema.sql` current when Phase 2 planning changes.
- Prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the public client key; keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` only for backward compatibility.
- If dev/Turbopack starts resolving from the wrong directory, check for root-level workspace artifacts first. The app belongs in `inventory-web`.

## Current File Map

- `src/app` - Routes, layout, metadata, and PWA files
- `src/components/app-shell.tsx` - Desktop and mobile navigation
- `src/components/inventory-provider.tsx` - Client store and action API
- `src/lib/auth.ts` - User roles and permission helpers
- `src/lib/inventory-types.ts` - Shared domain types
- `src/lib/inventory-seed.ts` - Phase 1 seed records
- `src/lib/inventory-reducer.ts` - Store mutations and activity entries
- `src/lib/inventory-utils.ts` - Filtering, summaries, and CSV helpers
- `src/lib/supabase` - Supabase client, auth, session, and type helpers
- `supabase/phase2_schema.sql` - Phase 2 schema and RLS starter kit

## Phase 2 Reminder

- Keep the data model ready for Supabase/Postgres.
- Preserve route names and workflows where possible.
- Add auth, persistence, and audit logging only when the app is otherwise stable.
