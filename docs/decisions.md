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
| PGlite for database tests | Real Postgres without Docker; runs in CI | If tests need Supabase services beyond Postgres |
| Static CSP without nonces | Keeps public pages static | Portal pages, if a script-injection risk appears there |
| Theme follows the OS, no toggle | No script or cookie; public pages stay static | — |
| Rate limiting in Vercel Firewall | No extra service | When per-user limits are needed |
| `features/` + shared `lib/` | Each business area in one place as the app grows | — |
| Invite-only accounts; deactivate, never delete | B2B: staff are invited, Closers create clients; restrict foreign keys keep history resolvable | — |
| Résumé bytes in Postgres (`bytea`, ≤ 2 MB), not Storage | One store and one access model while files are rare and small | When files grow in number or size, or need download links |
| Documentation split: root `CLAUDE.md` (rules and map), folder `CLAUDE.md` files (area detail, loaded only there), `docs/` (runbooks, decisions, roadmap) | The root file loads into every AI session; area detail only matters in its area | — |
