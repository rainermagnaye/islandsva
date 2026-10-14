# Operations

How to set up, change and run the live project. Rules for writing code are in `CLAUDE.md` and the folder `CLAUDE.md` files.

## Environment and secrets

- `.env` (committed) holds non-secret defaults and lists every other key as a comment. Real values and all secrets go in `.env.local` (git-ignored), which overrides `.env`. `npm test` fails if a secret is set in `.env`.
- Server code reads env only through `lib/env.ts`; a missing key fails just the request that needs it.
- `SUPABASE_SECRET_KEY` bypasses row-level security — server only, never `NEXT_PUBLIC_`.
- Production keys live in Vercel, marked Sensitive.

## Supabase

Project ref: `qqqfahnyajwgugylcbtn` (Singapore). `supabase/config.toml` only configures a local stack — every hosted setting below is made in the Supabase dashboard.

- **Access token hook** (required — without it nobody gets a role): Authentication → Auth Hooks → Customize Access Token → Postgres, `public.custom_access_token_hook`. Enabled 2026-10-13.
- **Sign-ups:** Authentication → Sign In / Providers → turn **"Allow new users to sign up" off** (accounts are invite-only). *Pending.* Leave the **Email provider enabled** — switching it off disables password sign-in for everyone (`email_provider_disabled`; it happened on 2026-10-14).
- **URLs:** Site URL, plus redirect URLs `/auth/confirm` and, while the temporary invite flow exists, `/accept-invite`. *Pending for production.*
- **Email:** 24-hour link expiry, password rules (10–72, letters and digits), custom SMTP (Resend) and the two `supabase/templates/`. *Pending* — the hosted free plan rejects template changes until custom SMTP is set.

### Applying a migration

Migrations are applied by a person, one at a time, in order. The CLI isn't linked with the database password, so `npx supabase db push` isn't used; the script below does the same and records the migration.

1. Merge (or review) the `db/` PR with the new file in `supabase/migrations/`.
2. Build an apply script that runs the migration and records it, in one transaction:
   ```sql
   begin;
   -- contents of supabase/migrations/<version>_<name>.sql
   insert into supabase_migrations.schema_migrations (version, name) values ('<version>', '<name>');
   commit;
   ```
3. Rehearse it on PGlite against the earlier migrations, with some existing rows (`npm test` covers the migration itself; the rehearsal covers the apply script).
4. Run it: `npx supabase db query --linked --project-ref qqqfahnyajwgugylcbtn -f <apply-script.sql>`.
5. Verify read-only: the version is in `supabase_migrations.schema_migrations`, and the new policies, grants or functions exist.

If any statement fails, the transaction rolls back and nothing is applied.

### Creating an admin

1. Create the user in the dashboard (Authentication → Users), or invite them from Teams once an admin exists.
2. Grant the role: `npm run admin:create -- <email>` against the project `.env.local` points at (you type the password), or insert a `roles` row (`role = 'admin'`) in the SQL editor.
3. They sign in, set up an authenticator app at `/mfa`, and land on `/admin`.

## Troubleshooting sign-in

The server log names the Supabase Auth code (`Sign-in failed (configuration): <code>`). `email_provider_disabled` → re-enable the Email provider; `invalid_api_key` → check `SUPABASE_PUBLISHABLE_KEY`; an account that signs in but lands on "not set up yet" → the access token hook is off or the account has no role.

## Local development

- `npm run dev` on port 3000 — one dev server per folder. Restart it after a `next build` in the same folder.
- Run `npm run lint`, `typecheck`, `test` and `build` one after another before every push.

## Launch checklist

- Keys in Vercel (production and preview), marked Sensitive.
- The Vercel project, region `sin1` (from `vercel.json`, next to Supabase).
- Vercel Firewall rate limits on `/api/v1/leads` and the sign-in POSTs (Supabase sees our server's IP, so its per-IP limits don't separate visitors).
- Turnstile production keys (test keys are refused on the live deployment).
- The Supabase items above marked *Pending*.
- Privacy policy matches what the site actually does; legal review.
