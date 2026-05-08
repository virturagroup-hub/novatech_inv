# Green NVentory

Green printer and copier parts.

Green NVentory is Novatech’s internal inventory web app for reusable and green printer/copier parts. It is built for desktop, tablet, and Android Chrome, with PWA basics so staff can install it on phones when helpful.

The current application is a hybrid Phase 1/Phase 2 setup:

- inventory and workflow state still use typed local mock data
- authentication and user management are wired for Supabase Auth
- the app is ready for Supabase/Postgres when you want to move the inventory data off the browser store

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase-ready auth and data helpers
- PWA manifest, icons, and theme metadata

## What The App Does

- Dashboard for inventory health and low-stock review
- Parts inventory table with search, filters, and quick quantity changes
- Add, edit, and view parts
- Location/bin tracking
- Compatible printer/copier model management
- Printable part tags and bin tags
- CSV import/export
- Activity log placeholder
- Mobile-friendly lookup and edit flows
- Admin-only user management for Supabase Auth

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

## Supabase Auth Setup

Authentication uses Supabase Email Auth. Public signups are disabled, so users do not self-register.

### Environment Variables

Create a local `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a legacy fallback by the helper layer, but `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the preferred public client key.

Only use `SUPABASE_SERVICE_ROLE_KEY` in server routes or server actions. Never expose it to client components.

If you deploy to Vercel, add the public Supabase vars to both Preview and Production environments. If either one is missing, middleware will fall back to a safe no-op instead of refreshing sessions.

### Required Supabase Settings

In your Supabase project:

1. Enable Email auth.
2. Disable public signups.
3. Keep password sign-in enabled.
4. Run [`supabase/phase2_schema.sql`](./supabase/phase2_schema.sql).

That schema creates the `profiles` table and the supporting tables used by the app:

- `profiles`
- `parts`
- `locations`
- `models`
- `part_model_links`
- `inventory_transactions`

## First Admin Account

Because self-registration is off, the first admin needs to be created manually in Supabase.

Recommended setup:

1. Open the Supabase dashboard.
2. Go to Authentication > Users.
3. Add a user with the admin email address and a temporary password.
4. Confirm the email if prompted or set the account to confirmed.
5. Open the SQL editor and promote the profile row to admin:

```sql
update public.profiles
set
  role = 'admin',
  full_name = 'Your Name',
  active = true,
  must_change_password = true
where id = '<auth-user-uuid>';
```

The app also has a profile trigger, so newly created auth users should get a matching profile row automatically. If you need to repair a missing profile, insert or update the row manually.

## Admin User Management

The admin user-management area lives at `/admin/users`.

Rules:

- Admin users can create accounts, edit users, deactivate accounts, and force password changes.
- Manager users can view the roster if allowed, but they cannot create admin users.
- Technician and viewer users cannot access the page.
- User creation happens server-side only.
- The service-role key stays on the server.

When an admin creates a user:

1. The admin enters name, email, role, and a temporary password.
2. Supabase Auth creates the account with `email_confirm: true`.
3. The app writes or updates the matching profile row.
4. The new profile is marked `must_change_password = true`.

## First Login Password Change

If `profiles.must_change_password` is true after sign-in, the app redirects the user to `/change-password`.

That page:

- explains why the password change is required
- asks for a new password and confirmation
- validates that the passwords match
- uses Supabase client auth to update the password
- clears `must_change_password` in the profile row
- sends the user back to the dashboard

Users can log out from the password change screen if they need to stop and come back later.

## Development Notes

- Keep role logic centralized in `src/lib/auth.ts`.
- Keep Supabase helpers in `src/lib/supabase`.
- Keep the `/print` route label-only so browser print previews never include the whole app shell.
- Keep the mobile navigation simple and touch-friendly.
- Do not reintroduce root-level workspace assumptions; the app lives in `inventory-web`.

## Deployment

This app is ready for Vercel deployment.

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Set the environment variables above.
4. Deploy with the default build command:

```bash
npm run build
```

Vercel handles HTTPS, static assets, the manifest, and the Android-friendly PWA experience.

You can verify the public Supabase env wiring without exposing secret values at:

```text
/api/diagnostics/supabase
```

## Android Installation

To install on Android phones:

1. Open the deployed app in Chrome on Android.
2. Wait for the page to finish loading.
3. Open the Chrome menu.
4. Choose `Install app` or `Add to Home screen`.
5. Confirm the install prompt.

The app includes:

- manifest metadata
- app icons
- theme color
- standalone display mode

## Project Map

- `src/app` - App Router routes, metadata, and PWA files
- `src/components/pages` - Route-level screens for the business workflows
- `src/components` - Shared shell, providers, and UI primitives
- `src/lib` - Typed inventory models, seed data, reducers, helpers, and Supabase utilities
- `supabase/phase2_schema.sql` - Phase 2 schema and RLS starter kit

## Resetting Phase 1 Data

If you need a clean local reset, use the `Reset demo data` action in the desktop shell or mobile menu.
