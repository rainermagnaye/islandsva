# Database (Supabase Postgres)

Loaded when working in `supabase/`. Project-wide rules are in the root `CLAUDE.md`; how a human applies a migration is in `docs/operations.md`.

## Migrations

- Live in `supabase/migrations/`, created with `npx supabase migration new <name>` (never hand-name them). Forward-only: a live migration is never edited — fix it with a new one.
- Reviewed in a `db/` PR and applied by a human, as one transaction that also records itself in `supabase_migrations.schema_migrations`, after a rehearsal on PGlite (procedure: `docs/operations.md`). No unrecorded dashboard edits.
- Applied so far (live: 31, up to `20261026040618`): `initial_schema`, `admin_leads_access`, `staff_profiles`, `staff_profiles_hardening`, `leads_created_at_index`, `super_admin_role`, `tenants`, `staff_avatar`, `lead_industry_country`, `lead_events`, `lead_call_attachment`, `lead_note_attachment`, `staff_references`, `client_package_setup`, `client_registration`, `client_notes`, `client_disabled`, `va_review`, `staff_address_fields`, `drop_address_parking`, `client_onboarding`, `client_activation`, `demo_scheduling`, `restore_assign_tenant_cases`, `activate_client_on_sign_in`, `payment_at_review`, plus the registration-packet five from #54 (`20261024022640_client_onboarding`, `client_review`, `client_review_return`, `client_timezone_from_country`, `staff_time_format`). Check against `supabase_migrations.schema_migrations` before trusting this list.
- `config.toml` configures only a local stack; hosted settings (auth hooks, SMTP, redirect URLs) are set in the dashboard.
- After a schema change, `types/database.ts` must match (hand-written until it is regenerated — see `docs/mvp.md`).

## Grants and RLS

- **Grants are explicit.** Default privileges are revoked, so a new table is reachable by no API role (not even `service_role`) until its migration grants exactly what each needs: `service_role` `select, insert, update, delete` (never `truncate`), `authenticated` only under RLS and often per column. `anon` gets nothing.
- **RLS on every table.** Policies read roles from the signed token via `private.has_role()` / `private.is_admin()` (admin + `aal2`), never by querying `roles` per row; wrap them as `(select private.…())` so they run once per statement. Tables without policies are server-only.
- Cross-table checks use `SECURITY DEFINER` helpers in `private` (no policy recursion); every `private` function sets `search_path = ''` and has execute revoked from `public`.
- Functions callable through the API are `security invoker` unless there's a written reason; `revoke all … from public, anon, authenticated, service_role` then grant exactly who may call them.

## Access model

- **Tenants first.** Every rule below applies inside the caller's tenant only: each tenant-owned table has a restrictive `Own tenant only` policy (`tenant_id = private.tenant_id()`, or `private.is_super_admin()` = `super_admin` + `aal2`). `private.is_admin()` is true for Super Admins too, so "admins with 2FA" means *of this tenant*, or a Super Admin anywhere. `tenants`: users read their own; Super Admins all; writes server-only.
- `profiles`, `roles`: users read their own; admins with 2FA read all. The token hook (`supabase_auth_admin`) reads both. Writes are server-only.
- `clients`: a client reads their own record, a VA those actively assigned to them, a Closer those they created (and creates and edits them), an admin with 2FA all. Status, activation and the login link are server-only (column grants). Conversion stores the agreed package and copies lead details into `business`. `registration_email_sent_at` (when the onboarding email was accepted by the mail provider), `consented_at` and `onboarding_submitted_at` are server-only; a Closer or admin may correct `billing`. `disabled_at` hides a client from the list without deleting the record. `onboarding_status` is the registration packet (`ready` through `invite_sent`); `client_packets` holds that packet's link, signature and payment file and is server-only. The time zone follows the client's country. `client_notes` is the append-only note list (`record_client_note`); admins read and insert their own rows. A note may include one file of up to 2 MB.
- `leads`: admins with 2FA read them, correct contact details and the `profile` jsonb, pause them (`disabled_at`), and delete one only while it is still `new` with no timeline (`IVA05`). Inserts and spam metadata stay server-only. `convert_lead()` (security invoker, row lock, one transaction; refusals `IVA01`–`IVA03`) turns one into a client. `convert_lead_noted` also stores the confirmed package on that client (slug, hours, term, monthly cents, start date, time zone). Status flow, also in the app (`nextStatuses()`): open leads move freely, closed ones only reopen, converted ones are final — enforced by the `leads_guard_status` trigger (`IVA04`). `lead_events` is the append-only timeline (`record_lead_step`, `record_lead_call`, `convert_lead_noted`); admins read and insert their own rows, never update or delete them. A call or a note may include one file of up to 2 MB.
- `staff_profiles`: staff (VA, Closer, admin) read and edit their own row, admins with 2FA everyone's. The address is one set of fields: street, additional info, city, state, postal code and country. Registration progress (`registration_status`, `invitation_sent_at`, `registration_completed_at`), the review (`review_status`, `returned_sections`, `return_note`) and the résumé bytes are server-only. A VA stays `invited` after setting a password; an admin sets `review_status` to `approved` and the account to `active`.
- `client_onboarding_links`: the onboarding form link a Closer sends a pending client. Only the token's SHA-256 is stored; links last 7 days, are single-use, one open per client, and are issued, revoked and used only by the server (`issue_onboarding_link`, `revoke_onboarding_link`, `submit_onboarding`, secret key only — each checks the actor is the client's Closer or an admin of its tenant). The Closer and admins with 2FA read link status, never `token_hash`; nobody else reads, and no signed-in user writes. Refusals `IVA06`–`IVA10`, `IVA13`, `IVA14`.
- `payments`: one row per payment, recorded by hand for now (`provider = manual`; Stripe in M4). An admin records it when confirming a registration packet: `accept_client_review_paid` (secret key only; the actor must be an active admin of the client's agency) approves the packet and stores the amount, `fee_cents` (bank or transfer fee, at most the amount), date and reference in one transaction; refusals `IVA14` (actor), `IVA21` (amount, fee or date), plus the review's `IVA06`/`IVA08`/`IVA09`. The sales summary totals paid payments: gross, fees, net = gross − fees. The client's Closer, the client (their own) and admins with 2FA read them; nobody else reads, and no signed-in user writes. `record_manual_payment` (the client's term, never a future date) and `void_payment` (only before activation) are secret key only, with the same actor check as onboarding links. A client with payments can't be deleted.
- Activation: `activate_client` (secret key only) needs the onboarding form submitted with consent, a `paid` payment, an enabled pending client and a fresh login (no roles, no client). In one transaction it moves the login into the client's tenant, grants `client` (assigned by the Closer or admin), links `user_id`, sets `active` and `activated_at`, and revokes open links. Refusals `IVA11` (form), `IVA12` (payment), `IVA15` (login already used).
- A client invited through the registration packet (`record_client_invite`, `onboarding_status = invite_sent`) becomes `active` with `activated_at` on the login's first sign-in (trigger on `profiles.signed_in_at`, `private.activate_client_on_sign_in`); a disabled client or one whose invite hasn't gone out stays pending.
- `client_va_assignments`: one active assignment per client. A VA reads their own, a Closer those for clients they created, a client those for their own record; admins with 2FA read all and create and update them.
- `demo_slots`: 30-minute slots (on :00 or :30) a VA publishes for demo calls. A VA adds their own only while open (not deactivated, profile approved: `private.va_is_open`, the app's `vaPortalOpen`), in the future and at most 30 days ahead, and deletes one only while it is ahead and unused (a trigger refuses deleting a used slot for anyone, including a delete racing a booking). A VA reads their own, a client only the slots they may book now (`private.open_slot_ids`: 4 hours to 14 days ahead, an open VA, unused), an admin with 2FA all.
- `demo_bookings`: a client's demo call. One open (`pending` or `confirmed`) per client (the 1-call rule); a slot is used once, unless cancelled. Company, client time zone and VA first name are snapshots, so neither side reads the other's record. Written only by `book_demo` (the client's own active login; the client active and enabled, no active VA; settles stale bookings first), `decide_demo` (the booking's VA, still an open VA, while pending and ahead) and `cancel_demo` (the client's own active login, before it starts), secret key only. The client, the VA, the client's Closer and admins with 2FA read them. Refusals `IVA16` (has a VA), `IVA17` (open demo), `IVA18` (slot unavailable), `IVA19` (too soon or far), `IVA20` (can't change now).

## Conventions

- uuid ids; user references point at `profiles(id)` (= `auth.uid()`); snake_case, plural tables, `_at` timestamps.
- Enums for statuses, one status column per thing (no `is_active` beside a status).
- Users and clients are **deactivated, never deleted**: restrict foreign keys keep history resolvable (`deleteAuthUser` only rolls back a failed invite).
- A column naming a user is role-checked by `private.enforce_role` (e.g. `clients.created_by` must be a Closer or admin — a Super Admin counts as an admin — `va_id` a VA), and a role can't be removed while something depends on it (`guard_role_removal`). Who may grant a role is checked from `assigned_by` (`guard_role_grant`): only a Super Admin grants `admin` / `super_admin`; an admin grants roles in their own tenant; an active Closer grants only `client`, in their own tenant; no `assigned_by` = a person at the database.
- **A new tenant-owned table** gets: `tenant_id uuid not null`; the `<table>_assign_tenant` trigger (inherit from the parent row; extend `private.assign_tenant()`); composite foreign keys `(col, tenant_id) → parent (id, tenant_id)` so it can't point across tenants; the `Own tenant only` restrictive policy; and `tenant_id` in no `authenticated` insert or update grant. A migration that redefines `private.assign_tenant()` keeps every existing case (a test fails if a table using the trigger has none).
- Invariants as constraints (`CHECK`, unique, FKs), mirroring the limits in each feature's `contract.ts`.
- Index foreign keys, RLS columns and list sort orders.
- Money in cents with a currency (M4). Secrets such as invite tokens stored only as SHA-256 (M3).
- Custom errors use their own SQLSTATE (`IVA01`…) so the app can map them to messages (see Error codes).

## Error codes

A code means something only together with the function that raised it: each `dal.ts` maps the codes of the functions it calls, never with one app-wide map. Some numbers mean different things in different functions (the registration packet reused `IVA06`–`IVA09`), so read this table by function. Live functions keep their codes; **a new refusal takes the next unused number, never an existing one, and is added here in the same PR.** Next free: `IVA21` (claimed by `accept_client_review_paid` in #72 once it merges), then `IVA22`.

| Code | Meaning | Raised by |
|---|---|---|
| `IVA01` | Not found (lead, client, payment or booking) | `convert_lead`, `convert_lead_noted`, `record_lead_step`/`_call`/`_note`, `record_client_note`, `issue_onboarding_link`, `revoke_onboarding_link`, `record_manual_payment`, `void_payment`, `activate_client`, `book_demo`, `decide_demo`, `cancel_demo` |
| `IVA02` | Lead already converted | `convert_lead` |
| `IVA03` | Lead is closed | `convert_lead` |
| `IVA04` | Lead disabled, step not available, or a converted lead changing | `convert_lead_noted`, `record_lead_step`, `record_lead_call`, `guard_lead_status` |
| `IVA05` | A lead with history can't be deleted | `guard_lead_delete` |
| `IVA06` | Registration packet: client or link not found · elsewhere: client in the wrong status (not pending, or not active for `book_demo`) | packet: `issue_client_onboarding_link`, `save_client_review`, `accept_client_review`, `record_client_invite`, `submit_client_packet` · status: `issue_onboarding_link`, `submit_onboarding`, `record_manual_payment`, `void_payment`, `activate_client`, `book_demo` |
| `IVA07` | Registration packet: a link or login already exists · elsewhere: client disabled | packet: `issue_client_onboarding_link`, `record_client_invite` · disabled: `issue_onboarding_link`, `submit_onboarding`, `record_manual_payment`, `activate_client`, `book_demo` |
| `IVA08` | Registration packet: wrong step (not in review, not open, not ready to activate) · `submit_onboarding`: unknown link | packet: `save_client_review`, `accept_client_review`, `record_client_invite`, `submit_client_packet` · `submit_onboarding` |
| `IVA09` | Registration packet: client disabled · `submit_onboarding`: link expired | packet: `issue_client_onboarding_link`, `save_client_review`, `accept_client_review`, `record_client_invite`, `submit_client_packet` · `submit_onboarding` |
| `IVA10` | Link already used or withdrawn | `submit_onboarding` |
| `IVA11` | Onboarding form not sent yet | `activate_client` |
| `IVA12` | No payment recorded | `activate_client` |
| `IVA13` | A form was sent moments ago | `issue_onboarding_link` |
| `IVA14` | The actor isn't allowed (not the client's Closer, an admin, the client or the booking's VA) | `issue_onboarding_link`, `revoke_onboarding_link`, `record_manual_payment`, `void_payment`, `activate_client`, `book_demo`, `decide_demo`, `cancel_demo` |
| `IVA15` | The login already belongs to someone | `activate_client` |
| `IVA16` | The client already has a VA | `book_demo` |
| `IVA17` | The client already has an open demo | `book_demo` |
| `IVA18` | The slot is gone or taken | `book_demo` |
| `IVA19` | Outside the booking window (4 hours to 14 days ahead) | `book_demo` |
| `IVA20` | The demo can't change now (started, or already answered) · a booked slot can't be deleted | `decide_demo`, `cancel_demo`, `guard_slot_delete` |

`issue_onboarding_link`, `revoke_onboarding_link`, `submit_onboarding`, `record_manual_payment`, `void_payment` and `activate_client` are live but unused since the registration packet replaced them (`docs/mvp.md`: cleanup migration).

## Tests (`supabase/tests/database.test.ts`)

- Every migration runs on PGlite against stand-ins for Supabase's roles and `auth` schema; `auth.jwt()` reads `request.jwt.claims`.
- Every policy and grant is tested **allowed and denied** per role (`asUser`, `asServer`, `as("anon")`), including an admin without `aal2`.
- A test for a security rule must fail when the rule is removed — check by temporarily dropping the migration or policy.
