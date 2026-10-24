# Database (Supabase Postgres)

Loaded when working in `supabase/`. Project-wide rules are in the root `CLAUDE.md`; how a human applies a migration is in `docs/operations.md`.

## Migrations

- Live in `supabase/migrations/`, created with `npx supabase migration new <name>` (never hand-name them). Forward-only: a live migration is never edited — fix it with a new one.
- Reviewed in a `db/` PR and applied by a human, as one transaction that also records itself in `supabase_migrations.schema_migrations`, after a rehearsal on PGlite (procedure: `docs/operations.md`). No unrecorded dashboard edits.
- Applied so far (all 13 files in `supabase/migrations/`, up to `20261018050000`): `initial_schema`, `admin_leads_access`, `staff_profiles`, `staff_profiles_hardening`, `leads_created_at_index`, `super_admin_role`, `tenants`, `staff_avatar`, `lead_industry_country`, `lead_events`, `lead_call_attachment`, `lead_note_attachment`, `staff_references`. Check against `supabase_migrations.schema_migrations` before trusting this list.
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
- `clients`: a client reads their own record, a VA those actively assigned to them, a Closer those they created (and creates and edits them), an admin with 2FA all. Status, activation and the login link are server-only (column grants). Conversion stores the agreed package and copies lead details into `business`. `registration_email_sent_at` is reserved for the registration email, which is not sent yet. `disabled_at` hides a client from the list without deleting the record. `client_notes` is the append-only note list (`record_client_note`); admins read and insert their own rows. A note may include one file of up to 2 MB.
- `leads`: admins with 2FA read them, correct contact details and the `profile` jsonb, pause them (`disabled_at`), and delete one only while it is still `new` with no timeline (`IVA05`). Inserts and spam metadata stay server-only. `convert_lead()` (security invoker, row lock, one transaction; refusals `IVA01`–`IVA03`) turns one into a client. `convert_lead_noted` also stores the confirmed package on that client (slug, hours, term, monthly cents, start date, time zone). Status flow, also in the app (`nextStatuses()`): open leads move freely, closed ones only reopen, converted ones are final — enforced by the `leads_guard_status` trigger (`IVA04`). `lead_events` is the append-only timeline (`record_lead_step`, `record_lead_call`, `convert_lead_noted`); admins read and insert their own rows, never update or delete them. A call or a note may include one file of up to 2 MB.
- `staff_profiles`: staff (VA, Closer, admin) read and edit their own row, admins with 2FA everyone's. The address is one set of fields: street, additional info, city, state, postal code and country. Registration progress (`registration_status`, `invitation_sent_at`, `registration_completed_at`), the review (`review_status`, `returned_sections`, `return_note`) and the résumé bytes are server-only. A VA stays `invited` after setting a password; an admin sets `review_status` to `approved` and the account to `active`.
- `client_va_assignments`: one active assignment per client. A VA reads their own, a Closer those for clients they created, a client those for their own record; admins with 2FA read all and create and update them.

## Conventions

- uuid ids; user references point at `profiles(id)` (= `auth.uid()`); snake_case, plural tables, `_at` timestamps.
- Enums for statuses, one status column per thing (no `is_active` beside a status).
- Users and clients are **deactivated, never deleted**: restrict foreign keys keep history resolvable (`deleteAuthUser` only rolls back a failed invite).
- A column naming a user is role-checked by `private.enforce_role` (e.g. `clients.created_by` must be a Closer or admin — a Super Admin counts as an admin — `va_id` a VA), and a role can't be removed while something depends on it (`guard_role_removal`). Who may grant a role is checked from `assigned_by` (`guard_role_grant`): only a Super Admin grants `admin` / `super_admin`; an admin grants roles in their own tenant; no `assigned_by` = a person at the database.
- **A new tenant-owned table** gets: `tenant_id uuid not null`; the `<table>_assign_tenant` trigger (inherit from the parent row; extend `private.assign_tenant()`); composite foreign keys `(col, tenant_id) → parent (id, tenant_id)` so it can't point across tenants; the `Own tenant only` restrictive policy; and `tenant_id` in no `authenticated` insert or update grant.
- Invariants as constraints (`CHECK`, unique, FKs), mirroring the limits in each feature's `contract.ts`.
- Index foreign keys, RLS columns and list sort orders.
- Money in cents with a currency (M4). Secrets such as invite tokens stored only as SHA-256 (M3).
- Custom errors use their own SQLSTATE (`IVA01`…) so the app can map them to messages.

## Tests (`supabase/tests/database.test.ts`)

- Every migration runs on PGlite against stand-ins for Supabase's roles and `auth` schema; `auth.jwt()` reads `request.jwt.claims`.
- Every policy and grant is tested **allowed and denied** per role (`asUser`, `asServer`, `as("anon")`), including an admin without `aal2`.
- A test for a security rule must fail when the rule is removed — check by temporarily dropping the migration or policy.
