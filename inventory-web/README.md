# Green NVentory

Internal green and reusable printer/copier parts inventory for Novatech.

This rebuild uses:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- PWA basics for Android installability
- a Supabase/Postgres-ready architecture

The current build is Phase 1. It uses typed mock data with browser-local persistence so the workflows are stable before the Supabase migration.

## What The App Does

- Dashboard for inventory health and low-stock review
- Parts inventory table with search, filters, and quick stock changes
- Part detail pages plus create/edit flows
- Mobile lookup for parts, bins, and models
- Printer/copier model management
- Location and bin management
- Printable part tags and bin tags
- CSV import/export and report downloads
- Activity log placeholder
- Role-aware UI for admin, manager, technician, and viewer users
- Responsive desktop, tablet, and Android web support

## Local Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app at `http://localhost:3000`.

## Validation

Run the standard checks before shipping changes:

```bash
npm run lint
npm run typecheck
npm run build
```

## Development Notes

- The local demo auth flow is intentionally separate from Supabase for Phase 1.
- Role logic is centralized in `src/lib/auth.ts`.
- Inventory state lives in a reducer and typed helpers so the UI can stay stable when the database layer changes.
- Print output uses the dedicated `/print` route so the browser print preview only shows labels.

## Supabase Phase 2

Phase 2 is ready to connect without rewriting the UI.

Use the SQL setup file at [`supabase/phase2_schema.sql`](./supabase/phase2_schema.sql) to create:

- `profiles`
- `parts`
- `locations`
- `models`
- `part_model_links`
- `inventory_transactions`

Supabase helper files already exist in `src/lib/supabase` for:

- browser client setup
- server client setup
- shared table/profile type definitions

### Environment Variables

Set these in `.env.local` when you are ready to connect Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is optional and only needed for true server-side admin tasks. If your Supabase dashboard exposes the older publishable key name, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also accepted by the helper layer as a fallback.

### Supabase Setup Steps

1. Create a Supabase project.
2. Open the SQL editor.
3. Run [`supabase/phase2_schema.sql`](./supabase/phase2_schema.sql).
4. Add the environment variables above.
5. Keep the Phase 1 local auth/store until the Phase 2 migration is ready to swap in real auth and persistence.

The schema file uses a `profiles.role` column so future auth can map cleanly to:

- admin
- manager
- technician
- viewer

## Deployment

This app is ready for Vercel deployment.

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Let Vercel detect it as a Next.js app.
4. Set the environment variables if you are using Supabase.
5. Deploy with the default build command:

```bash
npm run build
```

Vercel handles HTTPS, static assets, the manifest, and the Android-friendly PWA experience.

## Android Installation

To install on Android phones:

1. Open the deployed app in Chrome on Android.
2. Wait for the page to finish loading.
3. Open the Chrome menu.
4. Choose `Install app` or `Add to Home screen`.
5. Confirm the install prompt.

The app already includes:

- manifest metadata
- app icons
- theme color
- standalone display mode
- a safe production service worker

## Project Map

- `src/app` - App Router routes, metadata, and PWA files
- `src/components/pages` - Route-level screens for the business workflows
- `src/components` - Shared shell, providers, and UI primitives
- `src/lib` - Typed inventory models, seed data, reducers, helpers, and Supabase utilities
- `supabase/phase2_schema.sql` - Phase 2 schema and starter RLS policies

## Resetting Phase 1 Data

If you need a clean local reset, use the `Reset demo data` action in the settings page or the desktop/mobile workspace shell.
