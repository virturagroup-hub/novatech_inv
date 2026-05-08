# Novatech Inventory

Internal printer and copier parts inventory app for the Novatech team.

This repo is rebuilt as a modern Next.js App Router application with:

- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase/Postgres-ready typed data layers
- Vercel-friendly deployment
- PWA basics for Android installability

The current build is Phase 1: it uses typed mock data with browser-local persistence so the workflows are stable before the Supabase migration.

## Features

- Dashboard
- Inventory table with search, filters, and row actions
- Part detail view
- Add/edit/view parts
- Bin and location tracking
- Quantity on hand and low-stock indicators
- Compatible printer/copier model links
- Printable inventory and bin tags
- CSV import/export
- Activity log
- Mobile-friendly navigation and layouts
- PWA manifest, icons, theme color, and service worker registration

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app at `http://localhost:3000`.

## Quality Checks

Run the standard checks before shipping changes:

```bash
npm run lint
npm run typecheck
npm run build
```

## Project Structure

- `src/app` - App Router routes, metadata, PWA files, and layout
- `src/components/pages` - Route-level client components for dashboard and business workflows
- `src/components` - Shared shell, provider, and reusable UI pieces
- `src/lib` - Typed inventory models, seed data, reducers, and utilities
- `public/sw.js` - Minimal service worker used for safe install support

## Phase 1 Data Model

The app currently stores inventory in browser-local state using typed seed data. The reducer and helpers are already shaped so Phase 2 can swap the local store for Supabase/Postgres without rewriting the UI.

If you need a clean reset, use:

- `Settings` page
- Sidebar or mobile menu `Reset demo data`

## Deployment

This app is ready for Vercel deployment.

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Let Vercel detect it as a Next.js app.
4. Deploy with the default build command:

```bash
npm run build
```

Vercel will handle the production hosting, HTTPS, and static asset delivery needed for the PWA manifest and service worker.

## Android Installation

To install on Android phones:

1. Open the deployed app in Chrome on Android.
2. Wait for the page to finish loading.
3. Open the Chrome menu.
4. Choose `Install app` or `Add to Home screen`.
5. Confirm the install prompt.

The app is configured with:

- `manifest.webmanifest`
- app icons
- theme color
- standalone display mode
- production service worker registration

## Phase 2 Direction

The next phase should replace the browser-local store with Supabase/Postgres, keep the current UI intact, and preserve the existing routes and workflows.
