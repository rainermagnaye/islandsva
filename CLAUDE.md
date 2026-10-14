@AGENTS.md

# Islands VA — Engineering Guide

Rules for the team and AI agents; change them by PR. Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before using a Next API.

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, client/VA portal, agency back office. Scope: `Island-VA-MVP.docx`.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel · Resend · Cloudflare Turnstile. Runtime deps: `next`, `react`, `react-dom`, and server-only `zod`, `@supabase/ssr`, `@supabase/supabase-js` (none reach the browser).
- **Priorities:** secure → correct → maintainable → performant.
- **Phases:** M1 public site (done) → **M2 auth, role dashboards, admin system (current)** → M3 Closer onboarding → M4 packages + payments (1/6/12 months) → M5 client view + demo booking → M6 VA client list + 1-call rule → M7 admin lists + sales summary.
- **Build only the current phase.** Not in MVP: blog, chatbot, client rating, VA mailer, salary deductions, Staff module, native apps, i18n.
- **Domain:** roles Client, VA, Closer, Admin (a user can hold several). *Lead* = contact-form submission. *Client* = a company record (`clients`), `pending` until activated; it gets a login only when invited. *Staff* = VA, Closer or Admin, with a `staff_profiles` row. Accounts are invite-only.

## 2. Commands

```bash
npm run dev          # http://localhost:3000 — one dev server per folder (a second exits)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (run `npx next typegen` first in a fresh checkout)
npm test             # Vitest: validators, helpers, createHandler, roles, every migration + RLS policy (PGlite)
npm run build        # every public route must stay ○ (static)
npm run size         # after build: first-load JS per page vs the §8 budget (exit 1 if over)
npm run start        # serve the production build
npm run tokens       # regenerate app/tokens.css from design/tokens.json
npm run admin:create -- <email>        # make an account admin in the project .env.local points at; you type the password
npx supabase migration new <name>      # new SQL file in supabase/migrations/
npx supabase gen types typescript --project-id <ref> > types/database.ts   # after a schema change (see §11)
```

`lint`, `typecheck`, `test` and `build` must pass before every push — run them one after another (the PGlite suite can starve when run in parallel). No `format` script or CI yet (§11).

**Gotchas:** `next build` while `next dev` runs in the same folder leaves the dev server serving stale CSS — restart it (or build in a separate `git worktree`). Windows paths in `node_modules` can exceed 260 characters; delete such folders with `\\?\`-prefixed paths.

## 3. Architecture

```
app/                  routes only — thin pages and endpoints
  (marketing)/        static public site; page-only layout UI in <page>/_components/
  (auth)/             sign-in screens: login · forgot-password · set-password · mfa · accept-invite (temporary, §6)
  (dashboard)/        portal: dashboard (fallback) · client · va · closer · admin (admins only, sidebar layout:
                      overview · leads + lead page · clients · users = Teams + staff profile page)
  auth/confirm/       email-link landing (invite, reset): token hash → session
  api/v1/<resource>/  Route Handlers — the HTTP API
features/<feature>/   one business area in one place (today: auth, leads, clients, users)
  contract.ts         [shared] payload/response types + limits — no Zod, safe for client imports
  validation.ts       [server] Zod schema + parseX()
  service.ts          [server] use cases — the business logic routes and actions call
  dal.ts              [server] queries for this feature's tables
  actions.ts          [server] Server Actions ('use server')
  email.ts · api-client.ts · components/   outbound email [server] · browser calls to /api/v1 [client] · feature UI
components/           shared UI: ui/ (design system) · layout/ (shell, nav, footer) · marketing/ (sections)
hooks/                [client] shared browser hooks, `use-x.ts` (today: use-current-path)
lib/                  shared infrastructure only
  api/                [server] createHandler, ApiError, ok/fail, Turnstile, IP hash
  auth/               roles.ts [shared] (role rules, homes, safeNextPath) · session.ts [server] (getSessionUser, requireUser, requireRole)
  supabase/           [server] server.ts (visitor session, RLS) · admin.ts (secret key) · proxy.ts (session refresh) · config.ts
  validation.ts       [server] parseWith, emailField, toSubmitResult — building blocks for every validation.ts
  env · upstream-error · cx
types/                shared types only (api.ts, form.ts, icon.ts, turnstile.d.ts, database.ts)
content/              typed static content and routes (content/routes.ts is the only source of internal URLs)
supabase/             migrations/ (SQL, CLI-named) · tests/ (PGlite migration + RLS suite) · templates/ (auth emails) · config.toml (local stack only)
design/               tokens.json, logo sources, the design-system guide PDF
scripts/              build-tokens · check-bundle (npm run size) · create-admin
proxy.ts              session refresh + convenience redirects on auth/portal routes (never authorization)
vercel.json           function region sin1 (next to Supabase)
```

New features get a folder when their phase starts, never earlier.

**Import direction:** `app → features → components · hooks · lib · types · content`. Request path: `route.ts` or `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.

- **Routes and actions are thin:** parse, check access, call a use case in `service.ts`, respond. No queries or business rules inline; the same use case serves both. Simple CRUD skips the service.
- **Services** take typed values, never `Request` or headers; the route decides what runs in `after()`.
- **Responses:** every `/api/v1` body is `ApiResponse<T>` (`types/api.ts`): `{ data }` or `{ error: { code, message, fieldErrors? } }`, built only with `ok()` / `fail()` from `lib/api/response.ts`, `data` typed by the feature's contract (`ok<LeadCreated>(…)`).
- **Pages** compose components and read data through a feature's `dal.ts` — never `fetch` our own API from the server.
- **Features** import their own files relatively (`./dal`); another feature only through its `service.ts`, types or components — never its `dal.ts`.
- **`lib/`** holds only what every feature shares; **`types/`** only what a second layer or feature needs; **`content/`** never imports components.
- **`hooks/`**: only when a second client component needs the logic; browser behaviour only — no data fetching, no theme or screen-size hooks (use CSS). Keep the rule a pure function beside the hook so it is unit-tested (`currentPath` / `useCurrentPath`). Logic one feature owns stays in that feature; form pending/error state is `<Form>` (`useActionState`), not a new hook.
- **`_components/`** is for one route's layout pieces; move to `components/` when a second route needs it.
- **[server]** files start with `import "server-only"`.
- **Server Actions** for mutations from our own pages that should update the UI at once (portal forms, sign-in/out, admin actions): one round trip, `refresh()` / `updateTag`, `cookies()`, `redirect()`, work without JS. Mutations only — they run one at a time, so never fetch data with them.
- **Route Handlers** for everything else: webhooks, cron, downloads, parallel reads (search, polling), external callers, and public anonymous forms that need a stable, rate-limitable URL (contact form → `POST /api/v1/leads`).
- **Rendering:** public and sign-in pages stay static — no `cookies()`, `headers()` or `searchParams` in Server Components outside `<Suspense>`. Portal pages are a static shell with the session-dependent part streamed (◐): `page.tsx` renders `<Suspense fallback={<WorkspaceSkeleton />}>` around an async component that calls `requireRole`. `usePathname` / `useSearchParams` on a route with an unknown dynamic param also need `<Suspense>` (with a non-suspending fallback). `createClient()` calls `connection()` first, because partial prefetching renders an App Shell with cookies and auth-js checks expiry with `Date.now()`. Cache with `'use cache'` + `cacheLife`; per-request dedupe with React `cache()`.
- **Access control:** every portal page and Server Action calls `requireRole([...])` (or `requireUser()`) from `lib/auth/session.ts` before reading or writing. Data functions then run as the signed-in user, so RLS checks again; a function using the secret key runs only after that check. The proxy and layouts are never the check. Wrong role → `notFound()`; an admin without two-factor sign-in → `/mfa`. Roles come from the verified access token (`getClaims()`), cached per request.
- **Content:** typed data with stable ids and prices in cents. Never invent testimonials, logos or business claims — leave `TODO(content)`. Placeholder data for layout work must be labelled, development-only and absent from production builds (see `content/testimonials.ts`).

**Fixed — don't introduce:** microservices, GraphQL or a separate backend; global state libraries (Redux and similar — use Server Components for data, URL search params for shareable UI state); folder-per-file-type structure (`controllers/`, `models/`, `utils/`).

## 4. Design system

Sources: the live system (https://claude.ai/artifact/Ha5kSyvZ7axkKvVYjupvpK) and `design/islands-va-design-system-guide.pdf` (v1.2). This file wins on architecture, auth, theme, the Sand & Sea logo and scope (no blog in the MVP); the PDF's Next.js chapter is not the implementation guide.

- `design/tokens.json` → `npm run tokens` → `app/tokens.css` (generated; never edit or hard-code hex).
- Tailwind only with brand tokens: `bg-surface-card`, `text-ink`, `rounded-lg`, `type-*` text styles, `elevation-*` shadows; 4px spacing scale.
- Theme follows the visitor's OS (`prefers-color-scheme`): token classes adapt; otherwise `dark:`. No toggle, no theme cookie.
- Reuse `components/ui` / `components/layout`; variants via props, not one-off styles. Portal: `Badge` (status = icon or dot + word + tint, never colour alone), `Alert`, `EmptyState`, `StatCard`, `DataTable` (rows become cards under 600px; CSS in `globals.css`), `Pagination`, `Breadcrumbs`. Marketing: `Hero` (day-and-night art), FAQ on `<details>` with FAQPage JSON-LD, testimonial grid, CTA band, wave `Footer`. All server components.
- Never copy showcase content (logos, quotes, prices, phone numbers). Last synced 2026-10-13 (tokens, icons, components, landing page). Intentional differences: no theme toggle, a tab row instead of a drawer for short phone menus, no Toast until an action needs one.
- Voice: sentence case, verb-first buttons ("Request my team", never "Submit"), "you / we / your VA". Orange is a fill, never text on light backgrounds.

## 5. Code conventions

| Item | Convention | Example |
|---|---|---|
| Files, folders | kebab-case | `contact-form.tsx` |
| Components | PascalCase, named export | `ContactForm` |
| Functions | camelCase, verb first | `parseLead`, `insertLead` |
| Hooks | `useX` in `hooks/use-x.ts` | `useCurrentPath` |
| API routes | plural nouns, versioned | `POST /api/v1/leads` |
| DB | snake_case, plural tables, `_at` timestamps | `leads.created_at` |
| Env vars | SCREAMING_SNAKE; `NEXT_PUBLIC_` only if safe for the browser | `RESEND_API_KEY` |
| Tests | `*.test.ts` beside source; E2E in `tests/e2e/` | `validation.test.ts` |

- Server Components by default; `'use client'` only on the smallest leaf that needs state, effects or browser APIs. ~200 lines per file. Named exports (default only where Next requires); `@/` imports; no barrel files.
- **Validation:** Zod, server-side only. Each input gets a `z.strictObject` schema in the feature's `validation.ts` and a `parseX(input: unknown)` returning `{ ok: true, value } | { ok: false, fieldErrors }`, or `{ ok: false, formError }` when no field can fix it (unknown keys, not an object, tampered form → `400`). Every route and Server Action validates this way. Limits live in `contract.ts` (shared with the form's `maxLength`) and are mirrored by DB `CHECK` constraints. Example: `features/leads/validation.ts`.
- **Untrusted files** (uploads): cap size before reading, cap decompressed output and extracted text, never throw out of a parser — see `features/users/resume-text.ts`.
- **Errors:** routes throw `ApiError`; `createHandler` returns it with `fail()`. Low-level clients throw `UpstreamError` (no user-facing text); callers log it and show a "try again" message (`503` in routes). UI errors use `error.tsx` / `global-error.tsx`. No `any`, no empty `catch`, no `@ts-ignore`.
- **Comments** explain *why* — required on secret-key queries, caching choices and non-obvious security checks.

## 6. Security

- **Secrets:** `.env` (committed) holds non-secret defaults and lists every other key as a comment; real values and secrets go in `.env.local` (git-ignored). `npm test` fails if a secret is in `.env`. Server env is read only through `lib/env.ts`; a missing key fails just that request. `SUPABASE_SECRET_KEY` bypasses RLS — only in `lib/supabase/admin.ts`, called only from `dal.ts` files after the caller is authorized. Production secrets live in Vercel, marked Sensitive.
- **Route Handlers** all use `createHandler`: JSON content type, same-site `Origin` (CSRF), body size, then the handler, which validates with `parseX`, authorizes the resource and returns a minimal response.
- **Server Actions** are public POST endpoints: check authentication and authorization inside each one, validate every argument with `parseX`, return a minimal `SubmitResult`, never raw errors. Only actions are exported from `actions.ts`. Next.js checks `Origin`; the body limit is 3 MB (`next.config.ts`, for résumé uploads).
- **Rate limiting:** a Vercel Firewall rule per route (required before launch; not configured yet). Public forms: honeypot (bots get a fake `201`) + Turnstile, rendered explicitly and verified server-side including the token's hostname; required in production, skipped in local dev without a secret; test keys refused on the live deployment. A Cloudflare outage is a `503`, not a failed check.
- No stack traces, SQL, PII or secrets in responses or URLs (ids in URLs are random UUIDs). Return `404`, not `403`, for resources the caller may not see.
- **Headers** (`next.config.ts`): HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, and a static CSP without nonces (nonces would break static rendering); CSP/HSTS in production builds only.
- **Privacy:** IPs are HMAC-hashed before storage; the Privacy Policy must match what the site actually does.
- **Auth:** `@supabase/ssr` cookie sessions, server-side only (no Supabase in the browser). Verify with `getClaims()`, never trust `getSession()` on the server. Sign-up disabled; accounts are invite-only (admins invite staff; Closers invite clients in M3). Passwords 10–72 chars with letters and digits. Credential errors share one message; "forgot password" always reports success (no account enumeration).
- **Users and roles:** `profiles` (same id as `auth.users`) holds `status`: `invited` → `active` on first sign-in → `inactive` when deactivated. Roles live in `roles` (one row per user per role, `app_role` = `ROLES` in `lib/auth/roles.ts`), written only by the server. The `custom_access_token_hook` copies them into `app_metadata.roles` (never `user_metadata`); inactive users get none. Role changes apply at the next token refresh (≤ 1 hour). The hook must be enabled in the Supabase dashboard, not just in `config.toml`.
- **Admins need two-factor sign-in (TOTP, `aal2`)** — enforced by `requireRole` and again by RLS.
- **Email links:** invite and reset use the `supabase/templates/` token-hash links to `/auth/confirm` (the one GET handler outside `createHandler`), which accepts only `invite` / `recovery` and redirects to fixed paths. After sign-in, users go straight to their workspace (admins via `/mfa`); `/dashboard` is the fallback without a role; `?next=` goes through `safeNextPath`.
  - **Temporary (until custom SMTP):** the hosted project still sends Supabase's default emails, whose links carry the session in the URL `#hash`. `/accept-invite` and `EmailLinkSession` (in the root layout, so on every page) read and clear the hash and post the tokens to `establishEmailSession`, which stores them with `setSession` (Supabase validates them). Remove all three, and `/accept-invite` from the redirect allow-list, once the token-hash emails are live (§11).

## 7. Database

- **Migrations** live in `supabase/migrations/` (`npx supabase migration new`), are forward-only, reviewed in a `db/` PR and applied by a human. The project isn't linked for `db push`; apply one migration as a single transaction that also records it — `begin;` + the file + `insert into supabase_migrations.schema_migrations (version, name) values (…);` + `commit;` — with `npx supabase db query --linked --project-ref <ref> -f <file>`, after rehearsing it on PGlite. No unrecorded dashboard edits. Applied so far: `initial_schema`, `admin_leads_access`, `staff_profiles`, `staff_profiles_hardening`.
- **Grants are explicit.** Default privileges are revoked, so a new table is reachable by no API role (not even `service_role`) until its migration grants exactly what each needs: `service_role` `select, insert, update, delete` (never `truncate`), `authenticated` only under RLS, often per column. `anon` gets nothing.
- **RLS on every table.** Policies read roles from the signed token via `private.has_role()` / `private.is_admin()` (admin + aal2), never by querying `roles` per row. Cross-table checks use `SECURITY DEFINER` helpers in `private` (no policy recursion); every `private` function sets `search_path = ''`. Tables without policies are server-only. Each policy is tested allowed and denied (`supabase/tests/`).
- **Access model:**
  - `profiles`, `roles`: users read their own; admins with 2FA read all.
  - `clients`: a client reads their own record, a VA those actively assigned to them, a Closer those they created (and creates and edits them), an admin with 2FA all. Status, activation and the login link are server-only (column grants).
  - `leads`: admins with 2FA read them and change only the triage columns; inserts are server-only. `convert_lead()` (security invoker, row lock, one transaction) turns one into a client. Status flow in the app (`nextStatuses()`) and the database (`leads_guard_status`): open leads move freely, closed ones only reopen, converted ones are final.
  - `staff_profiles`: staff (VA, Closer, admin) read and edit their own row, admins with 2FA everyone's; registration progress and the résumé file are server-only.
- **Conventions:** uuid ids; user references point at `profiles(id)` (= `auth.uid()`); enums for statuses, one status column per thing; users and clients are deactivated, never deleted (restrict foreign keys keep history; `deleteAuthUser` only rolls back a failed invite); a column naming a user is role-checked by `private.enforce_role`, and a role can't be removed while something depends on it; invariants as constraints (`CHECK`, unique, FKs); index FKs, RLS columns and list sort orders; money in cents with a currency (M4); secrets such as invite tokens only as SHA-256 (M3).

## 8. Performance & testing

| Budget | Target |
|---|---|
| Lighthouse, public pages (all four) | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page (`npm run size`). Now: public ~148, contact 155, sign-in ~158, `/admin` 158.9 — near the limit, so new client code there needs a saving elsewhere |

- Keep client components minimal; prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries. Justify any dependency over 30 KB.
- Images: `getImageProps()` + `<img>`/`<picture>` in Server Components (no client JS; `<Image>` adds ~5 KB per page); a `prefers-color-scheme` `<picture>` source for themed images. `next/font` (≤ 2 families); third-party scripts only on the pages that need them.
- **Tests (`npm test`):** every `parseX`; pure helpers (pagination, search params, triage rules, `currentPath`, résumé parsing); `createHandler`; role rules and `safeNextPath`; every migration with RLS allowed/denied per role. A test for a security limit should fail when the limit is removed. Still to add: Playwright E2E (`tests/e2e/`) for navigation, both themes, the contact form and sign-in. Untested auth or permission branches block review.

## 9. Workflow

- `main`: changes only by PR with approval (plus green CI once it exists).
- Branches `feat/` `fix/` `chore/` `refactor/` `db/`, short-lived. Conventional Commits (`feat(contact): add lead form`).
- PRs under 400 lines, describing changes, trade-offs, testing and any env var, dependency or schema change. 1 approval; 2 for database, auth, security or payments.
- This file is the single source of truth — no `docs/` folder or READMEs. A PR that changes a convention, folder, script or env var updates this file.

## 10. Decisions

| Decision | Why | Revisit |
|---|---|---|
| Server Actions for in-app mutations, Route Handlers for HTTP APIs | Actions update the UI in one round trip; routes give stable URLs for webhooks, external callers and rate limits | — |
| Zod, server-side only (pinned `4.6.5`) | Less code than hand-written checks; types inferred | — |
| `ApiResponse<T>` via `ok()` / `fail()` | One response shape for every endpoint | — |
| `@supabase/ssr` + `supabase-js` on the server only | Auth sessions and typed queries; browser bundle unchanged | — |
| Roles in the access token (custom access token hook) | No database query per request | If roles must apply instantly (sign the user out on change) |
| Admin two-factor in the app and in RLS | Admins see every client's data | — |
| PGlite for database tests | Real Postgres without Docker; runs in CI | If tests need Supabase services beyond Postgres |
| Static CSP without nonces | Keeps public pages static | Portal pages, if a script-injection risk appears there |
| Theme follows the OS, no toggle | No script or cookie | — |
| Rate limiting in Vercel Firewall | No extra service | When per-user limits are needed |
| `features/` + shared `lib/` | Each business area in one place | — |
| Invite-only accounts; deactivate, never delete | B2B: staff are invited, Closers create clients; history stays resolvable | — |

## 11. Pending (parked, not blocking)

- **Supabase:** disable sign-ups; set Site URL + `/auth/confirm` redirect URL, 24 h email link expiry and password rules; custom SMTP (Resend) and the two `supabase/templates/`, then remove the temporary hash-link invite flow (§6); regenerate `types/database.ts` (hand-written until then). Done: four migrations applied, access token hook enabled, first admin created.
- **Repo & tooling:** CI running lint, typecheck, test, build and `npm run size`; branch protection (paid plan) or the free CODEOWNERS + Actions guard; Prettier (editors already reformat on save — agree on it before mixing reformatting into PRs); `--max-warnings=0`; pin Node 24 (`.nvmrc` + `engines`).
- **Launch:** keys in Vercel; the Vercel project (region from `vercel.json`); Firewall rate limits on `/api/v1/leads` and sign-in POSTs (Supabase sees our server's IP, so its per-IP limits don't separate visitors).
- **Code:** `leads (created_at desc)` index for the unfiltered list (migration); content accessors (`getPackages()`); `monthlyPrice` → `monthlyPriceCents`; `type-*` instead of arbitrary font sizes; resend/revoke invites; move the staff profile form and Disable dialog onto `<Form>`; split the icon set to win back ~1.2 KB per page.
- **Content & legal:** prices, contact email, About story, client testimonials and logos (with consent), legal review, privacy policy accuracy.

## 12. Rules of engagement (AI agents)

- **Ask first:** no code changes without approval — propose the plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval each time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, touching production data, committing secrets.
- Don't commit unless asked. When unsure about a Next.js 16 API, read the bundled docs.
