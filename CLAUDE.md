@AGENTS.md

# Islands VA — Engineering Guide

Rules for the team and AI agents; change them by PR. This file holds everyday rules and the map; each fact lives in exactly one of these places — link, don't copy:

| Working on | Read |
|---|---|
| Database — migrations, grants, RLS, access model, database tests | `supabase/CLAUDE.md` (loaded when working there) |
| UI — design system, tokens, components, voice and brand | `components/CLAUDE.md` (loaded when working there) |
| Setup, applying migrations, launch · decisions · roadmap and pending work | `docs/operations.md` · `docs/decisions.md` · `docs/roadmap.md` (for people; not loaded) |
| Subagent roles | `.claude/agents/` (§10) |

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, client/VA portal, agency back office. Scope: `Island-VA-MVP.docx`.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel · Resend · Cloudflare Turnstile. Runtime deps stay minimal; `zod` and the Supabase packages are server-only and never reach the browser.
- **Priorities:** secure → correct → maintainable → performant.
- **Phase:** M2 — auth, role dashboards, admin system (`docs/roadmap.md`). **Build only the current phase.** Not in the MVP: blog, chatbot, client rating, VA mailer, salary deductions, Staff module, native apps, i18n.
- **Domain:** roles Client, VA, Closer (also called lead gen), Admin, plus Super Admin across tenants (a user can hold several). *Tenant* = an agency using the platform; today there is one ("Islands VA"), and every user and record belongs to exactly one. *Lead* = contact-form submission. *Client* = a company record, `pending` until activated; it gets a login only when invited. *Staff* = VA, Closer or Admin. Accounts are invite-only, and deactivated, never deleted.

## 2. Commands

```bash
npm run dev          # http://localhost:3000 — one dev server per folder (a second exits)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (run `npx next typegen` first in a fresh checkout or after adding a route)
npm test             # Vitest: validators, helpers, createHandler, roles, every migration + RLS policy (PGlite)
npm run build        # every public route must stay ○ (static)
npm run size         # after build: first-load JS per page vs the §8 budget (exit 1 if over)
npm run start        # serve the production build
npm run tokens       # regenerate app/tokens.css from design/tokens.json
npm run admin:create -- <email>        # make an account admin in the project .env.local points at
npx supabase migration new <name>      # new SQL file in supabase/migrations/
```

`lint`, `typecheck`, `test` and `build` must pass before every push — run them one after another (the PGlite suite can starve in parallel). CI (`ci.yml`) runs them plus `size` on every PR and push to `main`; a push to `staging` runs the same checks, then deploys it (`docs/operations.md`).

**Gotchas:** `next build` while `next dev` runs in the same folder leaves the dev server serving stale CSS — restart it, or build in a separate `git worktree`. Windows paths in `node_modules` can exceed 260 characters; delete such folders with `\\?\`-prefixed paths.

## 3. Architecture

```
app/                  routes only — thin pages and endpoints
  (marketing)/        static public site; page-only layout pieces in <page>/_components/
  (auth)/             sign-in: login · forgot-password · set-password · mfa · accept-invite (temporary, §6)
  (workspace)/        portal: dashboard (fallback) · client · va · closer (their clients: list · new · profile) · admin (admins only)
  auth/confirm/       email-link landing (token hash → session)
  onboarding/[token]  a client's onboarding form from an emailed link (public, noindex, no referrer; the token is the key)
  api/v1/<resource>/  Route Handlers — the HTTP API (plural nouns, versioned)
features/<feature>/   one business area (today: auth, leads, clients, users)
  contract.ts         [shared] payload/response types, labels, limits — no Zod, safe for client imports
  validation.ts       [server] Zod schemas + parseX()
  service.ts          [server] use cases — the business logic routes and actions call (simple CRUD skips it)
  dal.ts              [server] queries for this feature's tables
  actions.ts          [server] Server Actions ('use server'); only actions are exported
  email.ts · api-client.ts · components/   outbound email [server] · browser calls to /api/v1 [client] · feature UI
components/           shared UI: ui/ (design system) · layout/ (shell, nav, footer) · marketing/ (sections)
hooks/                [client] shared browser hooks, `use-x.ts` (today: use-current-path)
lib/                  shared infrastructure only
  api/                [server] createHandler, ApiError, ok/fail, Turnstile, IP hash
  auth/               roles.ts [shared] (roles, homes, safeNextPath) · session.ts [server] (getSessionUser, requireUser, requireRole)
  supabase/           [server] server.ts (visitor session, RLS) · admin.ts (secret key) · proxy.ts (session refresh) · config.ts
  validation.ts       [server] parseWith, emailField, toSubmitResult — building blocks for every validation.ts
  env · upstream-error · cx
types/                shared types only (api, form, icon, turnstile, database)
content/              typed static content; content/routes.ts is the only source of internal URLs
supabase/             migrations/ · tests/ · templates/ (auth emails) · config.toml (local stack only)
design/ · scripts/    tokens, logo sources, design-system PDF · build-tokens, check-bundle, create-admin
docs/ · .claude/      runbooks, decisions, roadmap · launch.json (preview servers), agents/ (§10)
proxy.ts              session refresh + convenience redirects on auth/portal routes (never authorization)
vercel.json           function region sin1 (next to Supabase); no Git deploys of `staging` (CI deploys it)
```

**Import direction:** `app → features → components · hooks · lib · types · content`. Request path: `route.ts` / `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.

- **Thin edges:** routes and actions check access, parse, call a service, respond — no queries or business rules inline; the same use case serves both. Services take typed values, never `Request` or headers; the caller decides what runs in `after()`.
- **Pages** compose components and read data through a feature's `dal.ts` — never `fetch` our own API from the server.
- **Boundaries:** a feature imports its own files relatively (`./dal`) and uses another only through its `service.ts`, types or components, never its `dal.ts`. `lib/` holds only what every feature shares; `types/` only what a second layer needs; `content/` never imports components. New features get a folder when their phase starts.
- **`hooks/`:** only when a second client component needs the logic; browser behaviour only — no data fetching, theme or screen-size hooks. Keep the rule a pure, tested function beside the hook (`currentPath` / `useCurrentPath`). Logic one feature owns stays there; form pending/error state is `<Form>` (`useActionState`), not a hook.
- **`_components/`** holds one route's pieces; move to `components/` when a second route needs one.
- **[server]** files start with `import "server-only"`.

**Fixed — don't introduce:** microservices, GraphQL or a separate backend; global state libraries (use Server Components for data, URL search params for shareable UI state); folder-per-file-type structure (`controllers/`, `models/`, `utils/`).

## 4. Routes and rendering

- **Server Actions** for mutations from our own pages that should update the UI at once (portal forms, sign-in/out, admin actions): one round trip, `refresh()` / `updateTag`, `cookies()`, `redirect()`, work without JS. Mutations only — they run one at a time, so never fetch data with them.
- **Route Handlers** for webhooks, cron, downloads, parallel reads (search, polling), external callers, and public anonymous forms that need a stable, rate-limitable URL (contact form → `POST /api/v1/leads`).
- **Static public pages:** public and sign-in pages stay ○ — no `cookies()`, `headers()` or `searchParams` in Server Components outside `<Suspense>`.
- **Streamed portal pages (◐):** `page.tsx` renders `<Suspense fallback={<WorkspaceSkeleton />}>` around an async component that calls `requireRole` first.
- `usePathname` / `useSearchParams` on a route with an unknown dynamic param (e.g. `/admin/leads/[id]`) suspend: wrap the client component in `<Suspense>` with a fallback that doesn't suspend.
- `createClient()` calls `connection()` first: partial prefetching renders an App Shell with cookies, and auth-js checks expiry with `Date.now()`.
- Cache with `'use cache'` + `cacheLife` (e.g. the footer year); per-request dedupe with React `cache()` (e.g. counts shared by the sidebar badge and a page).
- Titles of pages about a person stay generic ("Lead", "Staff") — names stay out of tab titles and history.
- UI errors use `error.tsx` per route group and `global-error.tsx`: a calm message and a way forward, never the error itself.

## 5. Features: data, validation, errors

- **Data access:** `dal.ts` reads and writes as the signed-in user (`createClient()`, publishable key + session), so RLS checks again after the page or action's own check. Unknown or malformed ids return `null` (→ `notFound()`), never a database error.
- **The secret key** (`createAdminClient()` in `lib/supabase/admin.ts`, the only place it is read) bypasses RLS: only in `dal.ts`, only after the caller is authorized, always with a comment saying why. Typical uses: the anonymous contact form, writes the API mustn't reach (résumé bytes, registration progress), Auth admin calls.
- **Validation:** Zod, server-side only. Each input gets a `z.strictObject` schema and a `parseX(input: unknown)` returning `{ ok: true, value } | { ok: false, fieldErrors }`, or `{ ok: false, formError }` when no field can fix it (unknown keys, not an object, tampered hidden input → `400`). Build on `lib/validation.ts`; example `features/leads/validation.ts`. Every route and Server Action validates this way — TypeScript types are not runtime checks. Limits live in `contract.ts` (shared with the form's `maxLength`) and are mirrored by database `CHECK` constraints.
- **Errors:** low-level clients throw `UpstreamError` (no user-facing text). Actions catch it, log it with its `service` and return a "try again" `SubmitResult` (`types/form.ts`); routes let `createHandler` turn it into a `503`. Routes throw `ApiError` for expected failures. No `any`, no empty `catch`, no `@ts-ignore`.
- **Untrusted files** (uploads such as résumés): cap the size before reading, cap decompressed output and extracted text, never throw out of a parser — a bad file is stored or rejected, not a crash (`features/users/resume-text.ts` and its zip-bomb test). The Server Action body limit is 3 MB (`next.config.ts`).

## 6. Security and auth

- **Access:** every portal page and Server Action calls `requireRole([...])` / `requireUser()` (`lib/auth/session.ts`) before reading or writing; data then runs under RLS as that user. `proxy.ts` and layouts are never the check (a layout may hide UI, but the page still checks). Wrong role → `notFound()`; an admin without two-factor → `/mfa`.
- **Server Actions** are public POST endpoints: check auth inside each one, validate every argument with `parseX`, return a minimal `SubmitResult` — never raw errors, SQL or stack traces. Next.js checks `Origin`.
- **Route Handlers** all use `createHandler` (`lib/api/handler.ts`): `application/json` content type → same-site `Origin` (CSRF) → body size (header and bytes) → JSON parse → handler, which validates with `parseX`, authorizes the resource and returns a minimal response. `ApiError` → its status via `fail()`; `UpstreamError` → logged `503` with the route's message; anything else → logged `500`. Every body is `ApiResponse<T>` (`types/api.ts`: `{ data }` or `{ error: { code, message, fieldErrors? } }`) built only with `ok()` / `fail()`, `data` typed by the feature's contract (`ok<LeadCreated>(…)`); all API responses are `no-store`.
- **Public forms:** honeypot (`website` field: filled → a fake `201`, nothing stored) + Turnstile, rendered explicitly and verified server-side including the token's hostname — required in production, skipped in local dev without a secret, test keys refused on the live deployment; a Cloudflare outage is a `503`. Slow side effects (email) run in `after()`. Rate limiting is a Vercel Firewall rule per route (required before launch). The client onboarding form (`/onboarding/[token]` → `POST /api/v1/onboarding-submissions`) is the exception: its single-use 256-bit token is the gate, so no honeypot or Turnstile; it is rate-limited the same way.
- **Secrets:** env only through `lib/env.ts` (a missing key fails just that request); real values in `.env.local`, never in `.env` (`npm test` fails if one is) or `NEXT_PUBLIC_`; production keys in Vercel, Sensitive. No Supabase client in the browser.
- **Privacy:** no PII in URLs, logs or page titles (ids in URLs are random UUIDs); IPs are HMAC-hashed before storage (`lib/api/ip-hash.ts`); `404`, not `403`, for what the caller may not see; the Privacy Policy must match what the site does.
- **Headers** (`next.config.ts`): HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, and a static CSP without nonces (nonces would make every page dynamic); CSP and HSTS in production builds only.
- **Sessions:** `@supabase/ssr` cookie sessions, server-side only. Verify with `getClaims()` (checks the signature); never trust `getSession()` on the server. `getSessionUser()` is cached per request.
- **Accounts and roles:** invite-only, sign-up disabled (admins invite staff from Teams; Closers onboard and activate clients in M3). Supabase Auth owns `auth.users`; `profiles` (same id) holds `status`: `invited` → `active` on first sign-in, except a VA, who stays `invited` until an admin confirms their profile → `inactive` when deactivated. Roles live in `roles` (one row per user per role; `app_role` = `ROLES` in `lib/auth/roles.ts`, highest precedence first), written only by the server. The `custom_access_token_hook` copies them, and the user's `tenant_id`, into `app_metadata` (never `user_metadata`); inactive users get no roles; changes apply at the next token refresh (≤ 1 hour). The hook must be enabled in the Supabase dashboard — without it nobody gets a role. Only a Super Admin grants `admin` or `super_admin`; an admin grants roles only inside their tenant; an active Closer grants only `client`, inside their tenant, when activating a client they onboarded (all enforced by the database from `roles.assigned_by`).
- **Tenants:** RLS keeps every user inside their own tenant; a Super Admin with two-factor sees all. The app doesn't act on `super_admin` yet — a Super Admin also holds `admin` (`docs/roadmap.md`). Database rules: `supabase/CLAUDE.md`.
- **Two-factor:** admins and Super Admins need TOTP (`aal2`), enforced by `requireRole` and again by RLS. `/mfa` sets up an authenticator app on first use, then asks for a code at each sign-in.
- **Sign-in:** users go straight to their workspace (`homeFor(roles)` from the new token; admins via `/mfa`); `/dashboard` is only the fallback without a role; `?next=` goes through `safeNextPath` (same-site paths only). Credential errors share one message and "forgot password" always reports success (no account enumeration). Passwords 10–72 characters with letters and digits.
- **Email links:** invite and reset use the `supabase/templates/` token-hash links to `/auth/confirm` (client logins, created at activation, get the same link through Resend from `features/clients/email.ts`) — the one GET route outside `createHandler`, which accepts only `invite` / `recovery`, verifies server-side and redirects to fixed paths.
  - **Temporary (until custom SMTP):** Supabase's default emails carry the session in the URL `#hash`. `/accept-invite` and `EmailLinkSession` (root layout, every page) read and clear it and post the tokens to `establishEmailSession`, which calls `setSession` (Supabase validates them). Remove all three, and `/accept-invite` from the redirect allow-list, once token-hash emails are live.
- **Content:** never invent testimonials, logos or business claims — real content or `TODO(content)`; placeholder quotes stay labelled with a Sample badge until real ones replace them (`content/testimonials.ts`).

## 7. Code conventions

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

- Server Components by default; `'use client'` only on the smallest leaf that needs it. ~200 lines per file. Named exports (default only where Next requires); `@/` imports; no barrel files.
- **Comments** explain *why* — required on secret-key queries, caching choices and non-obvious security checks.

## 8. Performance and testing

| Budget | Target |
|---|---|
| Lighthouse, public pages (all four) | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page (`npm run size`). Sign-in and `/admin` are near the limit — new client code there needs a saving elsewhere |

- Keep client components minimal; prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries. Justify any dependency over 30 KB. `next/font` (≤ 2 families); third-party scripts only on the pages that need them.
- **Tests:** every `parseX` and pure rule (triage flow, registration steps, invite results, parsers, `currentPath`); `createHandler`; role rules and `safeNextPath`; every migration with RLS allowed and denied per role. A test for a security limit must fail when the limit is removed. Untested auth or permission branches block review.

## 9. Workflow and documentation

- `main` changes only by PR with approval and green CI; fill in the PR template (`.github/pull_request_template.md`). Branches `feat/` `fix/` `chore/` `refactor/` `db/`, short-lived; Conventional Commits (`feat(contact): add lead form`).
- PRs under 400 lines, describing changes, trade-offs, testing and any env var, dependency or schema change. 1 approval; 2 for database, auth, security or payments.
- **Documentation** lives only where the table at the top says; `README.md` only points here. No other READMEs, folder guides or doc folders without a PR that updates this rule. A PR that changes a convention, folder, script, env var or decision updates the right file in the same PR.

## 10. Rules of engagement (AI agents)

- **Ask first:** no code changes without approval — propose the plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval each time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, touching production data, committing secrets.
- Don't commit unless asked. Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before using a Next API (`AGENTS.md`).
- **Subagents** (`.claude/agents/`): `software-architect` designs (read-only), `software-developer` implements approved plans, `devops-security-engineer` reviews security and owns CI, config and runbooks. They define only their role (rules stay here), get no MCP tools, and stop at any approval gate above so the main session asks the user.
