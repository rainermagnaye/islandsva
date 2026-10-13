@AGENTS.md

# Islands VA — Engineering Guide

Rules for the team and AI agents; change them by PR. Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before using a Next API.

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, client/VA portal, agency back office. Scope: `Island-VA-MVP.docx`.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel · Resend · Cloudflare Turnstile. Runtime deps: `next`, `react`, `react-dom`, and server-only `zod`, `@supabase/ssr`, `@supabase/supabase-js` (none reach the browser).
- **Priorities:** secure → correct → maintainable → performant.
- **Phases:** M1 public site (built: 9 marketing pages + `POST /api/v1/leads`) → **M2 auth + role dashboards (current)** → M3 Closer onboarding → M4 packages + payments (1/6/12 months) → M5 client view + demo booking → M6 VA client list + 1-call rule → M7 admin lists + sales summary.
- **Build only the current phase.** Not in MVP: blog, chatbot, client rating, VA mailer, salary deductions, Staff module, native apps, i18n.
- **Domain:** roles Client, VA, Closer, Admin (a user can hold several). *Lead* = contact-form submission. *Client* = a company record (`clients`) created by a Closer, `pending` until activated; it gets a login only when they accept their invite. Accounts are invite-only.

## 2. Commands

```bash
npm run dev          # http://localhost:3000
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # every public route must stay ○ (static)
npm run start        # serve the production build
npm run size         # after build: first-load JS per page vs the §8 budget (exit 1 if over)
npm test             # Vitest: validators, createHandler, auth rules, and every migration + RLS policy (PGlite, no Docker)
npm run tokens       # regenerate app/tokens.css from design/tokens.json
npm run admin:create -- <email>        # first admin (or make an account admin) in the project .env.local points at; you type the password
npx supabase migration new <name>      # new SQL file in supabase/migrations/
npx supabase db push                   # apply pending migrations to the linked project (after `npx supabase link`)
npx supabase gen types typescript --project-id <ref> > types/database.ts   # after every schema change
```

`lint`, `typecheck`, `test` and `build` must pass before every push. No `format` script or CI yet (§11).

## 3. Architecture

```
app/                  routes only — thin pages and endpoints
  (marketing)/        static public site; page-only layout UI in <page>/_components/
  (auth)/             sign-in screens: login · forgot-password · set-password · mfa
  (dashboard)/        portal: dashboard (fallback) · client · va · closer · admin (admins only, sidebar layout: overview · leads · team)
  auth/confirm/       email-link landing (invite, reset): token hash → session
  api/v1/<resource>/  Route Handlers — the HTTP API
features/<feature>/   one business area in one place (today: leads, auth, users, clients)
  contract.ts         [shared] payload/response types + limits — no Zod, safe for client imports
  validation.ts       [server] Zod schema + parseX()
  service.ts          [server] use cases — the business logic routes and actions call
  dal.ts              [server] queries for this feature's tables
  email.ts            [server] outbound email
  actions.ts          [server] Server Actions ('use server')
  api-client.ts       [client] browser calls to /api/v1
  components/         feature UI (e.g. contact form)
components/           shared UI: ui/ (design system) · layout/ (shell, nav, footer) · marketing/ (sections)
lib/                  shared infrastructure only
  api/                [server] createHandler, ApiError, ok/fail, Turnstile, IP hash
  auth/               roles.ts [shared] (role rules, homes, safeNextPath) · session.ts [server] (getSessionUser, requireUser, requireRole)
  supabase/           [server] server.ts (visitor session, RLS) · admin.ts (secret key) · proxy.ts (session refresh) · config.ts
  validation.ts       [server] parseWith, emailField, toSubmitResult — building blocks for every validation.ts
  env · upstream-error · cx
types/                shared types only (api.ts, form.ts, icon.ts, turnstile.d.ts, database.ts)
supabase/             migrations/ (SQL, CLI-named) · tests/ (PGlite migration + RLS suite) · templates/ (auth emails) · config.toml
proxy.ts              session refresh + convenience redirects, auth/portal routes only (never authorization)
vercel.json           function region sin1 (next to Supabase)
content/              typed static content and routes
design/ · scripts/    design tokens and their build script
```

New features get a folder when their phase starts, never earlier.

**Import direction:** `app → features → components · lib · types · content`. Request path: `route.ts` or `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.

- **Routes and actions are thin:** they handle only the request and response — parse, check, call a use case in `service.ts`, respond. No queries or business rules inline; the same use case serves both.
- **Responses:** every `/api/v1` body is `ApiResponse<T>` (`types/api.ts`): `{ data }` or `{ error: { code, message, fieldErrors? } }`. Build it only with `ok()` / `fail()` from `lib/api/response.ts`; type `data` with the feature's contract (`ok<LeadCreated>(…)`).
- **Pages** compose components and read data through a feature's `dal.ts` — never `fetch` our own API from the server.
- **Features** import their own files relatively (`./dal`). Another feature is used only through its `service.ts`, types or components — never its `dal.ts`.
- **Services** take typed values, never `Request` or headers; the route decides what runs in `after()`. Simple CRUD skips the service.
- **`lib/`** holds only what every feature shares. **`types/`** only what a second layer or feature needs. **`content/`** never imports components; internal URLs come from `content/routes.ts`.
- **`hooks/`** (created with the first one): only when a second client component needs the logic; browser behaviour only — no data fetching, no theme or screen-size hooks (use CSS).
- **`_components/`** is for one route's layout pieces; move to `components/` when a second route needs it.
- **[server]** files start with `import "server-only"`.
- **Server Actions vs Route Handlers:**
  - **Server Actions** for changes made from our own pages that should update the UI at once — portal forms, login/logout, admin and VA actions (M2+). They re-render in one round trip, can use `updateTag`, `cookies()` and `redirect()`, and work without JS. Only for mutations: they run one at a time, so never use them to fetch data.
  - **Route Handlers** for everything else — webhooks, cron, file/CSV downloads, parallel reads (search, polling), anything called from outside our UI, and public anonymous forms that need a stable, rate-limitable URL (the contact form → `POST /api/v1/leads`).
- **Rendering:** public and sign-in pages stay static — no `cookies()`, `headers()` or `searchParams` in Server Components; request-time reads go inside `<Suspense>`. Portal pages are a static shell with the session-dependent part streamed (◐): `page.tsx` renders `<Suspense fallback={<WorkspaceSkeleton />}>` around an async component that calls `requireRole`. Session reads always run at request time: `createClient()` calls `connection()` first, because partial prefetching renders an App Shell with cookies and auth-js checks token expiry with `Date.now()`. Cache with `'use cache'` + `cacheLife`.
- **Access control:** every portal page, Server Action and data function calls `requireRole([...])` (or `requireUser()`) from `lib/auth/session.ts` — the proxy and layouts are never the check. Wrong role → `notFound()`; an admin without two-factor sign-in → `/mfa`. Roles come from the verified access token (`getClaims()`), cached per request.
- **Content:** typed data with stable ids and prices in cents. Never invent testimonials, logos or business claims — leave `TODO(content)`.

**Avoid** — this architecture is fixed; don't introduce:
- Microservices, GraphQL or a separate backend — one Next.js app is the backend.
- Global state libraries (Redux and similar) — use Server Components for data and URL search params for shareable UI state (read inside `<Suspense>` on public pages, per the rendering rule).
- `fetch` to our own API from Server Components — call the feature's `service.ts` / `dal.ts` directly.
- Auth checks only in `proxy.ts` or layouts — check in every route, action and data access (M2+).
- Folder-per-file-type structure (`controllers/`, `models/`, `utils/`) — code lives in its feature folder.

## 4. Design system

Source: the **Islands VA** design system (https://claude.ai/artifact/Ha5kSyvZ7axkKvVYjupvpK). This file wins where they differ.

- `design/tokens.json` → `npm run tokens` → `app/tokens.css` (generated; never edit or hard-code hex).
- Tailwind is limited to brand tokens: `bg-surface-card`, `text-ink`, `rounded-lg`, `type-*` text styles, `elevation-*` shadows; 4px spacing scale.
- Theme follows the visitor's OS (`prefers-color-scheme`): token classes adapt automatically, otherwise use `dark:`. No toggle, no theme cookie.
- Reuse `components/ui` and `components/layout`; add variants via props, not one-off styles.
- Voice: sentence case, verb-first buttons ("Request my team", never "Submit"), "you / we / your VA". Orange is a fill, never text on light backgrounds.

## 5. Code conventions

| Item | Convention | Example |
|---|---|---|
| Files, folders | kebab-case | `contact-form.tsx` |
| Components | PascalCase, named export | `ContactForm` |
| Functions | camelCase, verb first | `parseLead`, `insertLead` |
| Hooks | `useX` in `use-x.ts` | `useDebounce` |
| API routes | plural nouns, versioned | `POST /api/v1/leads` |
| DB | snake_case, plural tables, `_at` timestamps | `leads.created_at` |
| Env vars | SCREAMING_SNAKE; `NEXT_PUBLIC_` only if safe for the browser | `RESEND_API_KEY` |
| Tests | `*.test.ts` beside source; E2E in `tests/e2e/` | `validation.test.ts` |

- Server Components by default; `'use client'` only on the smallest leaf that needs state, effects or browser APIs. ~200 lines per file.
- Named exports (default only where Next requires). Use `@/` imports; no barrel files.
- **Validation:** Zod, server-side only. Each input gets a `z.strictObject` schema in the feature's `validation.ts` (`server-only`) and a `parseX(input: unknown)` that returns `{ ok: true, value } | { ok: false, fieldErrors }` — or `{ ok: false, formError }` for problems no field can fix (unknown keys, not an object, tampered form → `400`). Every route and every Server Action validates its input this way; TypeScript types are not runtime checks. Limits live in `contract.ts` (shared with the form's `maxLength`, never importing Zod) and are mirrored by DB `CHECK` constraints. Example: `features/leads/validation.ts`.
- **Errors:** routes throw `ApiError`; `createHandler` returns it with `fail()`. Low-level clients throw `UpstreamError` (no user-facing text); `createHandler` logs it and returns `503` with the route's message. UI errors use `error.tsx` / `global-error.tsx`. No `any`, no empty `catch`, no `@ts-ignore`.
- **Comments** explain *why* — required on secret-key queries, caching choices and non-obvious security checks.

## 6. Security

- **Secrets:** `.env` (committed) holds shared non-secret defaults and lists every other key as a comment; each person's real values and all secrets go in `.env.local` (git-ignored), which overrides `.env`. `npm test` fails if a secret is set in `.env`. Server env is read only through `lib/env.ts`; a missing key fails just that request (`503`). `SUPABASE_SECRET_KEY` bypasses RLS — used only in `lib/supabase/admin.ts`, called only from `dal.ts` files after the caller is authorized; reads for signed-in users use the publishable key + session so RLS applies too. Production secrets live in Vercel, marked Sensitive.
- **Every Route Handler uses `createHandler`**, which checks in order: JSON content type and same-site `Origin` (CSRF), body size, then the handler. Each route then validates with `parseX`, authorizes the specific resource (M2+), and returns a minimal response.
- **Every Server Action** is a public POST endpoint, reachable without our UI: check authentication and authorization inside each one, validate every argument with `parseX`, return a minimal `SubmitResult`, never raw errors. Only actions are exported from `actions.ts`. Next.js adds an `Origin` check and a 1 MB body limit.
- Rate limiting: a Vercel Firewall rule per route (required before launch; not configured yet). Public forms: honeypot (bots get a fake `201`) + Turnstile, rendered explicitly (survives client-side navigation) and verified server-side, including the token's hostname. Required in production, skipped in local dev without a secret; Cloudflare's test keys work everywhere except the live deployment. A Cloudflare outage is a `503`, not a failed check.
- No stack traces, SQL, PII or secrets in responses or URLs. Return `404`, not `403`, for resources the caller may not see.
- Headers in `next.config.ts`: HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, and a static CSP without nonces (nonces would break static rendering). CSP/HSTS apply to production builds only.
- Privacy: IPs are HMAC-hashed before storage; the Privacy Policy must match what the site actually does.
- **Auth:** `@supabase/ssr` cookie sessions, server-side only (no Supabase in the browser). Verify with `getClaims()`, never trust `getSession()` on the server. Sign-up is disabled — accounts are invite-only (admins invite staff; Closers invite clients in M3). Passwords: 10–72 chars with letters and digits.
- **Users and roles:** Supabase Auth owns `auth.users`; `profiles` (same id) holds our side and `status` (`invited` → `active` on first sign-in → `inactive` when deactivated). Roles live in `roles` (one row per user per role, `app_role` enum = `ROLES` in `lib/auth/roles.ts`), written only by the server. The `custom_access_token_hook` copies them into `app_metadata.roles` (never `user_metadata`, which users can edit); inactive users get none. Role changes apply at the next token refresh (≤ 1 hour).
- **Admins need two-factor sign-in (TOTP, `aal2`)** — enforced by `requireRole` and again by RLS ("Admins with 2FA read all…" policies).
- **Email links** (invite, reset) use the `supabase/templates/` token-hash links to `/auth/confirm`, which accepts only `invite` / `recovery` and redirects to fixed paths (no open redirect). It is the one GET Route Handler outside `createHandler`. After sign-in the action redirects straight to the user's workspace (role from the new token; admins pass through `/mfa`); `/dashboard` is only the fallback for accounts without a role. Post-login `?next=` goes through `safeNextPath`.
- Credential errors share one message (no account enumeration); "forgot password" always reports success.

## 7. Database

- Migrations live in `supabase/migrations/` (create with `npx supabase migration new`), are reviewed in a `db/` PR, and applied by a human — staging first, then production (`npx supabase db push` or the SQL editor). No unrecorded dashboard edits. No local Docker stack: `npm test` runs every migration on PGlite instead.
- **Grants are explicit.** Default privileges are revoked, so a new table is reachable by no API role (not even `service_role`) until its migration grants exactly what each needs: `service_role` `select, insert, update, delete` (never `truncate`), `authenticated` reads under RLS. `anon` gets nothing.
- **Access model (RLS):** policies read roles from the signed token via `private.has_role()` / `private.is_admin()` (admin + aal2), never by querying `roles` per row. Users read their own `profiles` and `roles`. `clients`: a client reads their own record, a VA the clients actively assigned to them, a Closer the clients they created (and creates and edits them), an admin with 2FA everything. Status, activation and the login link on `clients` are server-only (column grants). `leads`: only admins with 2FA read them and change the triage columns (`status`, `closer_id`, `converted_client_id`); inserts stay server-only. Converting a lead runs `convert_lead()` (security invoker, row lock, one transaction); status changes follow one flow, in the app (`nextStatuses()`) and in the database (`leads_guard_status` trigger): open leads move freely, closed ones only reopen, converted ones are final. Every table without policies is server-only. Cross-table policy checks use `SECURITY DEFINER` helpers in `private` (no policy recursion); all `private` functions set `search_path = ''`.
- **Conventions:** uuid ids; user references point at `profiles(id)` (= `auth.uid()`); enums for statuses, one status column per thing (no `is_active` beside a status); users and clients are deactivated, never deleted (restrict foreign keys keep history resolvable); a column naming a user is role-checked by `private.enforce_role` (e.g. `clients.created_by` must be a Closer or admin, `va_id` a VA), and a role can't be removed while something depends on it; money in cents with a currency (M4); secrets such as invite tokens stored only as SHA-256 (M3).
- RLS on every table. Server-only tables: zero policies and no `anon`/`authenticated` grants. Others: explicit per-role policies, each tested allowed and denied.
- Invariants as constraints (`CHECK`, unique, FKs); index FKs and RLS columns. Changes are forward-only.

## 8. Performance & testing

| Budget (public pages) | Target |
|---|---|
| Lighthouse (all four) | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page, checked by `npm run size` (framework baseline ~145 KB; contact ~151 KB) |

- Keep client components minimal; prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries. Justify any dependency over 30 KB.
- Images: `getImageProps()` + `<img>`/`<picture>` in Server Components (optimised, 0 KB client JS — `<Image>` adds ~5 KB per page); a `<picture>` `prefers-color-scheme` source for themed images so only one downloads. `next/font` (≤ 2 families); third-party scripts only on the pages that need them.
- **Tests (`npm test`, Vitest):** every `parseX`; `createHandler`; role rules and `safeNextPath`; every migration with RLS allowed/denied per role (`supabase/tests/`). Still to add: Playwright E2E (`tests/e2e/`) for navigation, both themes, the contact form and sign-in. Untested auth or permission branches block review.

## 9. Workflow

- `main` is protected once the GitHub remote exists: PR + green CI + approval, squash merge.
- Branches `feat/` `fix/` `chore/` `refactor/` `db/`, short-lived. Conventional Commits (`feat(contact): add lead form`).
- PRs under 400 lines, describing changes, trade-offs, testing, and any env var, dependency or schema change. 1 approval; 2 for database, auth, security or payments.
- This file is the single source of truth — no `docs/` folder or READMEs. A PR that changes a convention, folder, script or env var updates this file.

## 10. Decisions

| Decision | Why | Revisit |
|---|---|---|
| Server Actions for in-app mutations, Route Handlers for HTTP APIs | Actions update the UI in one round trip; routes give stable URLs for webhooks, external callers and rate limits | — |
| Zod for validation, server-side only (pinned `4.6.5`) | Less code than hand-written checks as M2–M7 add inputs; types inferred | — |
| `ApiResponse<T>` via `ok()` / `fail()` | One response shape for every endpoint and the browser | — |
| `@supabase/ssr` + `supabase-js` on the server only; CLI migrations in `supabase/` | Auth sessions need them; typed queries; versioned schema. Browser bundle unchanged | — |
| Roles in the access token (custom access token hook) | Role checks read the token — no database query per request | If roles must apply instantly (sign the user out on change) |
| Admin two-factor enforced in the app and in RLS | Admins see every client's data | — |
| PGlite for database tests | Real Postgres without Docker; runs in CI | If tests need Supabase services beyond Postgres |
| Static CSP without nonces | Keeps public pages static | Portal pages, if a script-injection risk appears there |
| Theme follows the OS, no toggle | No script or cookie | — |
| Rate limiting in Vercel Firewall | No extra service | Per-user limits in M2 |
| `features/` + shared `lib/` | Each business area in one place as the app grows | — |
| Invite-only accounts | B2B: Closers create clients; staff are invited | — |

## 11. Pending (parked, not blocking)

- **Supabase setup (M2):** both migrations applied (2026-10-13) and first admin created; enable the custom access token hook in the dashboard (Authentication → Auth Hooks — `config.toml` only configures a local stack; without it nobody gets their role); disable sign-ups; set Site URL + `/auth/confirm` redirect URL, 24 h email link expiry and password rules; custom SMTP (Resend) and the two `supabase/templates/`; further admins via `npm run admin:create -- <email>`. Then regenerate `types/database.ts` (hand-written for the tables in use until then). Package pricing per term (1/6/12 months) is decided in M4; `packages` has no seed rows until then.
- **Repo & tooling:** CI running lint, typecheck, test, build and `npm run size`; branch protection (paid plan) or the free CODEOWNERS + Actions guard; Prettier; `--max-warnings=0`; pin Node 24 (`.nvmrc` + `engines`).
- **Launch:** set keys in Vercel; create the Vercel project (region from `vercel.json`); Firewall rate limits on `/api/v1/leads` and sign-in POSTs (Supabase sees our server's IP, so its per-IP limits don't separate visitors).
- **Code:** content accessors (`getPackages()`); rename `monthlyPrice` → `monthlyPriceCents`; `type-*` instead of arbitrary font sizes; resend/revoke invites and deactivate users (M7 user list).
- **Content & legal:** prices, contact email, About story, legal review, privacy policy accuracy; hide Testimonials/Brands until real content exists.

## 12. Rules of engagement (AI agents)

- **Ask first:** no code changes without approval — propose the plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval each time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, touching production data, committing secrets.
- Don't commit unless asked. When unsure about a Next.js 16 API, read the bundled docs.
