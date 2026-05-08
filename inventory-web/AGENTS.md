# Project Standards

This repository is the Phase 1 rebuild of Novatech Inventory. Future Codex work should keep the app maintainable, mobile-friendly, and ready for a later Supabase migration.

## Architecture Rules

- Use Next.js App Router patterns.
- Keep route files in `src/app` and route-level client components in `src/components/pages`.
- Preserve the typed mock-data layer until Phase 2 explicitly replaces it.
- Keep inventory state flows in `src/lib` reducers and helpers rather than scattering logic across pages.
- Use shadcn/ui-style components for product UI.
- Favor responsive, dark, internal-tool layouts with large touch targets for Android phones.

## Data Rules

- Treat the browser-local store as Phase 1 only.
- Do not connect Supabase unless the app is already stable and the migration is explicitly in scope.
- Keep inventory, bin, model, and activity shapes typed and reusable.
- Update the seed data and migration notes when the structure changes.

## UI Rules

- Prefer reusable primitives such as `Button`, `Card`, `Badge`, `Input`, `Select`, `Tabs`, `Table`, `Sheet`, and `AlertDialog`.
- Use `buttonVariants` for link-as-button patterns instead of fragile wrapper hacks.
- Keep mobile navigation simple and touch-friendly.
- Preserve the PWA basics: manifest, icons, theme color, and the safe service worker registration.

## Workflow Rules

- Use `apply_patch` for manual file edits.
- Avoid destructive git commands.
- Do not revert user changes unless explicitly asked.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` before finishing.
- Update `README.md` and `MIGRATION_PLAN.md` when the app structure or workflow changes.

## Current File Map

- `src/app` - Routes, layout, metadata, PWA files
- `src/components/app-shell.tsx` - Desktop and mobile navigation
- `src/components/inventory-provider.tsx` - Client store and action API
- `src/lib/inventory-types.ts` - Shared domain types
- `src/lib/inventory-seed.ts` - Phase 1 seed records
- `src/lib/inventory-reducer.ts` - Store mutations and activity entries
- `src/lib/inventory-utils.ts` - Filtering, summaries, and CSV helpers

## Phase 2 Reminder

- Keep the data model ready for Supabase/Postgres.
- Preserve route names and workflows where possible.
- Add auth, persistence, and audit logging only when the app is otherwise stable.
