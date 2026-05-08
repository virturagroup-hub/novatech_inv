# Migration Plan

## What Was Found

The original Anything AI Builder project was treated as reference material rather than a clean production architecture. The source material exposed the business intent clearly enough to rebuild the app around the real workflows:

- Printer/copier parts inventory
- Location/bin tracking
- Quantity management
- Compatibility with printer/copier models
- Tag printing
- CSV import/export
- Basic activity tracking

The old structure was not kept as the final foundation.

## What Was Rebuilt

The app was rebuilt as a modern Next.js App Router project inside `inventory-web` with:

- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- A typed local inventory store
- Responsive desktop and Android-first layouts
- PWA basics for Android installability
- Vercel-ready routes and metadata

The Phase 1 implementation now includes:

- Dashboard
- Inventory table
- Part detail screen
- Lookup screen
- Printable tags screen
- Locations screen
- Models screen
- Import/export screen
- Activity screen
- Settings and admin-style views

## What Changed

- The app now uses typed mock data and browser-local persistence instead of an assumed database layer.
- Inventory mutations are centralized in a reducer.
- Reusable utilities handle filtering, summaries, compatibility checks, and CSV serialization.
- The mobile experience now has a bottom navigation pattern and large touch targets.
- PWA support was added through manifest, icons, theme color, and a minimal safe service worker.
- The docs were rewritten for setup, deployment, Android install, and future work.

## What Remains For Phase 2

- Replace browser-local persistence with Supabase/Postgres.
- Add real multi-user sync and authentication.
- Move audit logging into a proper database table.
- Add server-side validation and import processing.
- Improve printing templates if the tag workflow needs tighter physical formatting.
- Expand search or barcode scanning if the crew wants faster on-floor lookup.

## Guiding Principle

Phase 2 should swap the data layer without rewriting the UI or business workflows that are already working well in Phase 1.
