# Database (Supabase Postgres)

Loaded when working in `supabase/`. Project-wide rules are in the root `CLAUDE.md`; how a human applies a migration is in `docs/operations.md`.

## Migrations

- Live in `supabase/migrations/`, created with `npx supabase migration new <name>` (never hand-name them). Forward-only: a live migration is never edited — fix it with a new one.
- Reviewed in a `db/` PR and applied by a human, as one transaction that also records itself in `supabase_migrations.schema_migrations`, after a rehearsal on PGlite (procedure: `docs/operations.md`). No unrecorded dashboard edits.
- Applied so far (22, up to `20261024061808`): `initial_schema`, `admin_leads_access`, `staff_profiles`, `staff_profiles_hardening`, `leads_created_at_index`, `super_admin_role`, `tenants`, `staff_avatar`, `lead_industry_country`, `lead_events`, `lead_call_attachment`, `lead_note_attachment`, `staff_references`, `client_package_setup`, `client_registration`, `client_notes`, `client_disabled`, `va_review`, `staff_address_fields`, `drop_address_parking`, `client_onboarding`, `client_activation`. Check against `supabase_migrations.schema_migrations` before trusting this list.
- `config.toml` configures only a local stack; hosted settings (auth hooks, SMTP, redirect URLs) are set in the dashboard.
- After a schema change, `types/database.ts` must match (hand-written until it is regenerated — see `docs/roadmap.md`).

## Grants and RLS

- **Grants are explicit.** Default privileges are revoked, so a new table is reachable by no API role (not even `service_role`) until its migration grants exactly what each needs: `service_role` `select, insert, update, delete` (never `truncate`), `authenticated` only under RLS and often per column. `anon` gets nothing.
- **RLS on every table.** Policies read roles from the signed token via `private.has_role()` / `private.is_admin()` (admin + `aal2`), never by querying `roles` per row; wrap them as `(select private.…())` so they run once per statement. Tables without policies are server-only.
- Cross-table checks use `SECURITY DEFINER` helpers in `private` (no policy recursion); every `private` function sets `search_path = ''` and has execute revoked from `public`.
- Functions callable through the API are `security invoker` unless there's a written reason; `revoke all … from public, anon, authenticated, service_role` then grant exactly who may call them.

## Access model

- **Tenants first.** Every rule below applies inside the caller's tenant only: each tenant-owned table has a restrictive `Own tenant only` policy (`tenant_id = private.tenant_id()`, or `private.is_super_admin()` = `super_admin` + `aal2`). `private.is_admin()` is true for Super Admins too, so "admins with 2FA" means *of this tenant*, or a Super Admin anywhere. `tenants`: users read their own; Super Admins all; writes server-only.
- `profiles`, `roles`: users read their own; admins with 2FA read all. The token hook (`supabase_auth_admin`) reads both. Writes are server-only.
- `clients`: a client reads their own record, a VA those actively assigned to them, a Closer those they created (and creates and edits them), an admin with 2FA all. Status, activation and the login link are server-only (column grants). Conversion stores the agreed package and copies lead details into `business`. `registration_email_sent_at` (when the onboarding email was accepted by the mail provider), `consented_at` and `onboarding_submitted_at` are server-only; a Closer or admin may correct `billing`. `disabled_at` hides a client from the list without deleting the record. `client_notes` is the append-only note list (`record_client_note`); admins read and insert their own rows. A note may include one file of up to 2 MB.
- `leads`: admins with 2FA read them, correct contact details and the `profile` jsonb, pause them (`disabled_at`), and delete one only while it is still `new` with no timeline (`IVA05`). Inserts and spam metadata stay server-only. `convert_lead()` (security invoker, row lock, one transaction; refusals `IVA01`–`IVA03`) turns one into a client. `convert_lead_noted` also stores the confirmed package on that client (slug, hours, term, monthly cents, start date, time zone). Status flow, also in the app (`nextStatuses()`): open leads move freely, closed ones only reopen, converted ones are final — enforced by the `leads_guard_status` trigger (`IVA04`). `lead_events` is the append-only timeline (`record_lead_step`, `record_lead_call`, `convert_lead_noted`); admins read and insert their own rows, never update or delete them. A call or a note may include one file of up to 2 MB.
- `staff_profiles`: staff (VA, Closer, admin) read and edit their own row, admins with 2FA everyone's. The address is one set of fields: street, additional info, city, state, postal code and country. Registration progress (`registration_status`, `invitation_sent_at`, `registration_completed_at`), the review (`review_status`, `returned_sections`, `return_note`) and the résumé bytes are server-only. A VA stays `invited` after setting a password; an admin sets `review_status` to `approved` and the account to `active`.
- `client_onboarding_links`: the onboarding form link a Closer sends a pending client. Only the token's SHA-256 is stored; links last 7 days, are single-use, one open per client, and are issued, revoked and used only by the server (`issue_onboarding_link`, `revoke_onboarding_link`, `submit_onboarding`, secret key only — each checks the actor is the client's Closer or an admin of its tenant). The Closer and admins with 2FA read link status, never `token_hash`; nobody else reads, and no signed-in user writes. Refusals `IVA06`–`IVA10`, `IVA13`, `IVA14`.
- `payments`: one row per payment, recorded by hand for now (`provider = manual`; Stripe in M4). The client's Closer, the client (their own) and admins with 2FA read them; nobody else reads, and no signed-in user writes. `record_manual_payment` (the client's term, never a future date) and `void_payment` (only before activation) are secret key only, with the same actor check as onboarding links. A client with payments can't be deleted.
- Activation: `activate_client` (secret key only) needs the onboarding form submitted with consent, a `paid` payment, an enabled pending client and a fresh login (no roles, no client). In one transaction it moves the login into the client's tenant, grants `client` (assigned by the Closer or admin), links `user_id`, sets `active` and `activated_at`, and revokes open links. Refusals `IVA11` (form), `IVA12` (payment), `IVA15` (login already used).
- `client_va_assignments`: one active assignment per client. A VA reads their own, a Closer those for clients they created, a client those for their own record; admins with 2FA read all and create and update them.

## Conventions

- uuid ids; user references point at `profiles(id)` (= `auth.uid()`); snake_case, plural tables, `_at` timestamps.
- Enums for statuses, one status column per thing (no `is_active` beside a status).
- Users and clients are **deactivated, never deleted**: restrict foreign keys keep history resolvable (`deleteAuthUser` only rolls back a failed invite).
- A column naming a user is role-checked by `private.enforce_role` (e.g. `clients.created_by` must be a Closer or admin — a Super Admin counts as an admin — `va_id` a VA), and a role can't be removed while something depends on it (`guard_role_removal`). Who may grant a role is checked from `assigned_by` (`guard_role_grant`): only a Super Admin grants `admin` / `super_admin`; an admin grants roles in their own tenant; an active Closer grants only `client`, in their own tenant; no `assigned_by` = a person at the database.
- **A new tenant-owned table** gets: `tenant_id uuid not null`; the `<table>_assign_tenant` trigger (inherit from the parent row; extend `private.assign_tenant()`); composite foreign keys `(col, tenant_id) → parent (id, tenant_id)` so it can't point across tenants; the `Own tenant only` restrictive policy; and `tenant_id` in no `authenticated` insert or update grant.
- Invariants as constraints (`CHECK`, unique, FKs), mirroring the limits in each feature's `contract.ts`.
- Index foreign keys, RLS columns and list sort orders.
- Money in cents with a currency (M4). Secrets such as invite tokens stored only as SHA-256 (M3).
- Custom errors use their own SQLSTATE (`IVA01`…) so the app can map them to messages.

## Tests (`supabase/tests/database.test.ts`)

- Every migration runs on PGlite against stand-ins for Supabase's roles and `auth` schema; `auth.jwt()` reads `request.jwt.claims`.
- Every policy and grant is tested **allowed and denied** per role (`asUser`, `asServer`, `as("anon")`), including an admin without `aal2`.
- A test for a security rule must fail when the rule is removed — check by temporarily dropping the migration or policy.
