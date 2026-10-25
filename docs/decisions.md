# Decisions

Architecture decisions and why they were made. Change one by PR, updating the rule in `CLAUDE.md` (or the folder `CLAUDE.md`) that it explains.

| Decision | Why | Revisit |
|---|---|---|
| Server Actions for in-app mutations, Route Handlers for HTTP APIs | Actions update the UI in one round trip; routes give stable URLs for webhooks, external callers and rate limits | — |
| Zod for validation, server-side only (pinned `4.6.5`) | Less code than hand-written checks as M2–M7 add inputs; types inferred | — |
| `ApiResponse<T>` via `ok()` / `fail()` | One response shape for every endpoint | — |
| `@supabase/ssr` + `supabase-js` on the server only; CLI migrations in `supabase/` | Auth sessions and typed queries; versioned schema; browser bundle unchanged | — |
| Roles in the access token (custom access token hook) | Role checks read the token — no database query per request | If roles must apply instantly (sign the user out on change) |
| Admin two-factor enforced in the app and in RLS | Admins see every client's data | — |
| Multi-tenancy prepared, one tenant: `tenant_id` on every tenant-owned row, in the token, one restrictive RLS policy per table, composite foreign keys; Super Admin (2FA) across tenants; one tenant per user | Adding a second agency later is a data change, not a rewrite; existing per-role policies stay as they are | When a second tenant arrives: tenant per contact form and invite, Super Admin screens; memberships if a user needs several tenants |
| PGlite for database tests | Real Postgres without Docker; runs in CI | If tests need Supabase services beyond Postgres |
| Static CSP without nonces | Keeps public pages static | Portal pages, if a script-injection risk appears there |
| Theme follows the OS, no toggle | No script or cookie; public pages stay static | — |
| Demo scheduling: VA-published fixed 30-minute slots, pooled per tenant, in the app (no calendar sync); the client picks a time, not a person; 1-call rule = one open demo per client (partial unique index); stale bookings settled at the next booking, no cron | The smallest scheduler that enforces the rule in the database; no scheduled job or extra service | When VAs need recurring availability, reminders, no-show handling or external calendars |
| Rate limiting in Vercel Firewall | No extra service | When per-user limits are needed |
| `features/` + shared `lib/` | Each business area in one place as the app grows | — |
| Invite-only accounts; deactivate, never delete | B2B: staff are invited, Closers create clients; restrict foreign keys keep history resolvable | — |
| Résumé bytes in Postgres (`bytea`, ≤ 2 MB), not Storage | One store and one access model while files are rare and small | When files grow in number or size, or need download links |
| Documentation: root `CLAUDE.md` (everyday rules and map), `supabase/CLAUDE.md` and `components/CLAUDE.md` (database and UI, loaded only there), `docs/` (runbooks, decisions, roadmap) | Rules needed in most tasks stay always-loaded; the database and UI are separate workflows; runbooks and history aren't instructions. Fewer files, less drift | If another area grows its own workflow (e.g. payments in M4) |
