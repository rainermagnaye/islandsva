# Operations

How to set up, change and run the live project. Rules for writing code are in `CLAUDE.md` and the folder `CLAUDE.md` files.

## Environment and secrets

`.env` (committed) holds non-secret defaults and names every other key in a comment; `.env.local` (git-ignored) overrides it. The rules for secrets are in `CLAUDE.md` §6.

## Supabase

Project ref: `qqqfahnyajwgugylcbtn` (Singapore). `supabase/config.toml` only configures a local stack — every hosted setting below is made in the Supabase dashboard.

Local development uses this same project (there is no separate staging project yet), so it also allows `localhost` redirects. Do the steps in order; the hosted settings mirror `supabase/config.toml`.

**Done**

- **Access token hook** (required — without it nobody gets a role): Authentication → Auth Hooks → Customize Access Token → Postgres, `public.custom_access_token_hook`. Enabled 2026-10-13.
- **Sign-ups off:** Authentication → Sign In / Providers → **"Allow new users to sign up" off** (accounts are invite-only); **Confirm email** on. Done 2026-10-14. Leave **Email → Enable email provider** on — switching it off disables password sign-in for everyone (`email_provider_disabled`; it happened on 2026-10-14). After any Auth change, `GET /auth/v1/settings` with the publishable key should show `"email": true, "disable_signup": true`.

**1. Email and password rules** — Authentication → Sign In / Providers → Email, then **Save** at the bottom of the panel:

- Minimum password length **10**; password requirements **letters and digits** (the app's `PASSWORD_RULES`; 72 is bcrypt's limit).
- Email OTP expiration **86400** seconds (invite and reset links last 24 hours).
- Secure email change on; secure password change off (a reset link must be able to set a new password).

**2. URLs** — Authentication → URL Configuration:

- **Site URL:** `https://islandsva.com` (`NEXT_PUBLIC_SITE_URL`). The email templates build their links from it, so every invite and reset email points at production — including ones sent while testing locally.
- **Redirect URLs:** `https://islandsva.com/auth/confirm`, `http://localhost:3000/auth/confirm`, and, only while the temporary invite flow exists, `https://islandsva.com/accept-invite` and `http://localhost:3000/accept-invite`. Exact paths, no wildcards. Add the Vercel preview URL only if previews must handle email links.

**3. Custom SMTP (Resend)** — without it Supabase sends at most a few emails an hour, only to team addresses, and won't take our templates.

1. Resend → Domains: `islandsva.com` must be **Verified** (the lead emails already send from `noreply@islandsva.com`; if it isn't, add the DNS records Resend lists and wait for it).
2. Resend → API Keys → **Create**: name `supabase-auth`, permission **Sending access**, domain `islandsva.com`. A key of its own, so it can be revoked without stopping lead emails. Copy it once into the next step; don't store it anywhere else.
3. Supabase → Authentication → Emails → **SMTP Settings** → enable custom SMTP: sender email `noreply@islandsva.com`, sender name `Islands VA`, host `smtp.resend.com`, port `465`, username `resend`, password = the key. **Save.**
4. Authentication → Rate Limits: emails per hour starts at 30 once custom SMTP is on — enough for invites and resets; raise it only for a bulk invite.

**4. Email templates** — Authentication → Emails → Templates, after step 3:

- **Invite user:** subject `You're invited to Islands VA`, body = `supabase/templates/invite.html`.
- **Reset password:** subject `Reset your Islands VA password`, body = `supabase/templates/recovery.html`.
- Paste each file exactly (the subjects match `config.toml`). Both links go to `{{ .SiteURL }}/auth/confirm?token_hash=…`, which verifies on the server — no session in the URL.

**5. Test, then retire the temporary flow**

1. From Teams, invite a test address you control; the email comes from `noreply@islandsva.com` and its link opens `/auth/confirm`, then `/set-password`. Do the same with "Forgot password".
2. Only then merge the PR that removes the temporary hash-link flow (`CLAUDE.md` §6), and delete the two `/accept-invite` redirect URLs.
3. Deactivate the test account in Teams.

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

Reset or invite emails: "We couldn't send the reset email" is Supabase answering 5xx, logged as `Supabase Auth unavailable (supabase-auth, <status>, <code>): <message>`. Usually the email can't be sent: custom SMTP is on but the Resend domain isn't verified yet, or the sender address isn't on that domain (steps 3 in Supabase above). Supabase → Authentication → Logs shows the SMTP error. Without custom SMTP, Supabase only emails the project's team members — others are logged as `Password reset email not sent: <code>` while the visitor still sees success.

## Staging

- **URL:** https://islandsva-staging.vercel.app — Vercel project `islandsva` (team Islands VA), behind Vercel Authentication.
- **Deploys:** a push to the `staging` branch runs `.github/workflows/deploy-staging.yml`: the full CI suite, then `vercel build` + `vercel deploy --prebuilt` and the alias above. Vercel's own Git deploys are off for `staging` (`vercel.json`), so nothing reaches the URL unless every check passes. To ship: merge `main` into `staging` and push.
- **Environment:** a Preview deployment (`VERCEL_ENV=preview`), so it reads the project's **Preview** env vars. **For now there is one Supabase project:** staging, PR previews and local development all use the same project as production, so they read and write live data — test only with test accounts and test leads. A separate staging project is planned (`docs/mvp.md`); once it exists, Preview gets its keys and production keys go only in **Production**. `NODE_ENV` stays `production` (Next.js sets it) — tell staging apart with `VERCEL_ENV`. PR previews from Vercel's Git integration share the same Preview keys.
- **Secrets:** GitHub environment `staging` holds `VERCEL_TOKEN` (a Vercel token scoped to the Islands VA team). Team and project ids are in the workflow; they aren't secret.
- **Supabase (when the staging project is created):** apply every migration, enable `custom_access_token_hook`, set Site URL to the staging URL and add `https://islandsva-staging.vercel.app/auth/confirm` (and `/accept-invite` while the temporary invite flow exists) to the redirect URLs.

## Discovery-call emails (planned, M8 slices 4–5)

How they work: `docs/technical-spec.md` → Visitor emails. Before the acknowledgement goes live, a person:

1. **Resend:** verifies SPF, DKIM and DMARC for the sending domain; moves to Pro ($20/month, no daily cap) or keeps the free tier with the 40-a-day visitor cap well under its 100; watches bounces and complaints.
2. **Vercel Firewall:** rate-limits `POST /api/v1/leads` (e.g. 5 per 10 minutes per IP) and `GET /api/v1/discovery-slots`; `/api/v1/internal/*` is not under that rule.
3. **Secret:** generates one random secret for the expiry endpoint; adds it to Vercel as a Sensitive env var for **Production only** (rebuild to apply) and to Supabase Vault.
4. **Supabase:** enables `pg_cron` and `pg_net`, then schedules the 15-minute job (expire requests, then call `https://<production domain>/api/v1/internal/discovery-expiry` with the Vault secret). **Production URL only** — staging shares the database and never sends expiry emails.
5. **Rotating the secret:** set the new value in Vercel (rebuild), then in Vault; calls in between get `404` and the next run catches up, since notices are claimed only when sent.
6. **Privacy Policy and FAQ:** say we email the address given when a request is received, confirmed or expires (not when declined), that we keep the requested time and a hashed IP for abuse prevention, and how long unconfirmed requests are kept (`TODO(legal)` retention).

## Launch checklist

- Keys in Vercel (production and preview), marked Sensitive.
- The Vercel project, region `sin1` (from `vercel.json`, next to Supabase).
- Vercel Firewall rate limits on `/api/v1/leads` and the sign-in POSTs (Supabase sees our server's IP, so its per-IP limits don't separate visitors).
- Turnstile production keys (test keys are refused on the live deployment).
- Supabase steps 1–5 above (production settings, SMTP, templates, a test invite).
- Privacy policy matches what the site actually does; legal review.
