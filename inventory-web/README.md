# Green NVentory

Green printer and copier parts.

Green NVentory is Novatech’s internal inventory web app for reusable and green printer/copier parts. It is built for desktop, tablet, and Android Chrome, with PWA basics so staff can install it on phones when helpful.

The current application is a hybrid Phase 1/Phase 2 setup:

- inventory and workflow state still use typed local mock data
- authentication and user management use real Supabase Auth
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
- Admin-only role preview for testing permissions

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

### Login Behavior

- The login page asks for email and password.
- The app signs in with Supabase Auth `signInWithPassword`.
- Temporary passwords are still supported, but only as the password value for admin-created users.
- The email address is always the username.
- If `profiles.must_change_password` is true, users are redirected to `/change-password`.
- If `profiles.active` is false, the account is blocked until an admin reactivates it.
- If a user has an auth account but no matching profile row, the app blocks access and tells them to contact an admin.

### Environment Variables

Create a local `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the preferred public client key.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a legacy fallback by the helper layer.
- `NEXT_PUBLIC_APP_URL` is used to build absolute QR-code links for printed labels. Set it to your production domain in Vercel and to `http://localhost:3000` for local development.
- Only use `SUPABASE_SERVICE_ROLE_KEY` in server routes or server actions. Never expose it to client components.

If you deploy to Vercel, add the public Supabase vars and `NEXT_PUBLIC_APP_URL` to both **Preview** and **Production** environments. If either one is missing, middleware falls back to a safe no-op instead of refreshing sessions.

### Required Supabase Settings

In your Supabase project:

1. Enable Email auth.
2. Disable public signups.
3. Keep password sign-in enabled.
4. Run [`supabase/phase2_schema.sql`](./supabase/phase2_schema.sql).

The SQL file is rerunnable. If an older `profiles.is_active` column exists, the script migrates it to `profiles.active`.

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
  must_change_password = false
where id = '<auth-user-uuid>';
```

Set `must_change_password = true` instead if you want that first admin to go through the password-change flow the first time they sign in.

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
- sends the user back to the scanned route when one was provided, otherwise the dashboard

Users can log out from the password change screen if they need to stop and come back later.

## QR Scan Flow

Printed labels use absolute URLs so phones can scan them outside the app.

- Part labels open `/inventory/[partId]`.
- Bin labels open `/locations/[binId]`.
- If the user is not signed in, the app redirects to `/login?next=<relative-path>`.
- After login, the user returns to the scanned part or location page.
- The `next` value is sanitized so external URLs are rejected.

## View As Role

Admins can use **View as Role** from the Settings page to preview the interface as viewer, technician, or manager.

Important notes:

- Only a real admin can use the preview.
- The preview only changes the browser UI and local permission simulation.
- It does not change `public.profiles.role`.
- Server routes and server actions still use the real Supabase profile role.
- A banner appears whenever role preview is active.
- Use `Return to Admin` to clear the preview and restore the real admin UI.

This is role preview, not user impersonation.

## Local Testing

To verify the auth flow locally:

1. Start the dev server with `npm run dev`.
2. Open `http://localhost:3000/login`.
3. Sign in with your real Supabase email and password.
4. If your profile is active and `must_change_password` is false, you should land on the dashboard.
5. If `must_change_password` is true, you should be sent to `/change-password`.
6. Open Settings and use **View as Role** to preview technician, viewer, or manager behavior.
7. Use **Return to Admin** to restore the real admin UI.
8. Open a part or location page in a private browser session to confirm the login redirect returns you to the scanned route.

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
3. Set the environment variables above for both Preview and Production, including `NEXT_PUBLIC_APP_URL`.
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
