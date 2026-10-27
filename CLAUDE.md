@AGENTS.md

# Islands VA — Engineering Guide

Rules for people and AI agents; change them by PR. Each fact lives in one place — link, don't copy.

| Topic | File |
|---|---|
| Database as built: migrations, grants, RLS, access model, roles, database tests | `supabase/CLAUDE.md` (loaded when working there) |
| UI: design system, tokens, components, voice and brand | `components/CLAUDE.md` (loaded when working there; read it for any UI) |
| What we build · in what order · how planned parts will work | `docs/prd.md` · `docs/mvp.md` · `docs/technical-spec.md` |
| Runbooks (env, Supabase, migrations, staging, launch) · decisions | `docs/operations.md` · `docs/decisions.md` |
| Agent roles | `.claude/agents/` (§10) |

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, Lead Gen, client and VA workspaces, agency back office.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel (`sin1`) · Resend · Cloudflare Turnstile. Six runtime deps; `zod` and Supabase are server-only.
- **Priorities:** secure → correct → maintainable → performant.
- **Phase:** M7 — admin lists and sales summary; then M8–M13 (`docs/mvp.md`). **Build only the current phase.**
- **Domain:**
  - **Roles:** Client, VA, Lead Gen (`closer` in code), Admin; Super Admin across tenants. A user can hold several. **Employee** = VA, Lead Gen or Admin.
  - **Tenant** = an agency; one today ("Islands VA"); every user and record belongs to exactly one.
  - **Lead** = a contact-form enquiry. From M8 it carries a discovery call and is owned by the Lead Gen who confirms it.
  - **Client** = a company record, `pending` until activated, with a login only once invited; one stable link (no sign-in) opens its registration, consent and payment proof.
  - **Meeting** (from M8–M9) = any call — discovery, intro, client↔VA — as a Google Calendar event with Meet.

## 2. Commands

```bash
npm run dev          # http://localhost:3000 — one dev server per folder (a second exits)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (run `npx next typegen` first in a fresh checkout or after adding a route)
npm test             # Vitest, once: unit tests + every migration and RLS policy on PGlite
npm run test:watch   # Vitest, watching
npm run build        # production build (public routes must stay ○, §4)
npm run size         # after build: first-load JS per page vs §8 (exit 1 if over)
npm run start        # serve the production build
npm run tokens       # regenerate app/tokens.css from design/tokens.json
npm run admin:create -- <email>        # make an account admin in the project .env.local points at
npx supabase migration new <name>      # new SQL file in supabase/migrations/
```

**Checks before every push:** `lint`, `typecheck`, `test`, `build`, **one after another** (PGlite starves in parallel). CI (`ci.yml`) runs them plus `size` on every PR and push to `main`; a push to `staging` runs them, then deploys.

**Gotchas:** `next build` while `next dev` runs in the same folder leaves the dev server with stale CSS — restart it or build in a `git worktree`. Windows paths in `node_modules` can exceed 260 characters; delete them with `\\?\`-prefixed paths.

## 3. Architecture

```
app/                  routes only — thin pages and endpoints; robots, sitemap, OG image at the root
  (marketing)/        static public site; page-only pieces in <page>/_components/
  (auth)/             login · forgot-password · set-password · mfa · accept-invite (temporary, §6)
  (onboarding)/       register/[token] — the client's registration link
  (workspace)/        portal: dashboard (fallback) · profile · client · va · closer · admin; @search = header search slot
  auth/confirm/       email-link landing (token hash → session)
  api/v1/<resource>/  Route Handlers — the HTTP API (plural nouns, versioned)
features/<feature>/   one business area (today: auth, leads, clients, users, demos, sales, search, tasks, matching, meetings)
  contract.ts         [shared] types, labels, limits — no Zod, safe for client imports
  validation.ts       [server] Zod schemas + parseX() (split as <topic>-validation.ts when large)
  service.ts          [server] use cases routes and actions call (simple CRUD skips it)
  dal.ts              [server] queries for this feature's tables (split as <topic>-dal.ts when large)
  actions.ts          [server] Server Actions ('use server'); exports only actions
  email.ts · api-client.ts · components/   outbound email [server] · browser calls to /api/v1 [client] · feature UI
  <rule>.ts           pure rules, tested beside them (e.g. token.ts, invite-result.ts)
components/           shared UI (components/CLAUDE.md)
hooks/                [client] shared browser hooks, `use-x.ts`
lib/                  shared infrastructure only
  api/                [server] createHandler, createGetHandler, ApiError, ok/fail, Turnstile, IP hash
  auth/               roles.ts [shared] (roles, homes, safeNextPath) · session.ts [server] (getSessionUser, requireUser, requireRole)
  supabase/           [server] server.ts (session, RLS) · admin.ts (secret key) · proxy.ts (session refresh) · config.ts
  validation.ts       [server] parseWith, emailField, toSubmitResult, utcDay
  email.ts            [server] sendPlainEmail — all outbound email (Resend REST, plain text)
  bytea · env · upstream-error · uuid · cx
types/                shared types only (api, form, icon, turnstile, database)
content/              typed static content; content/routes.ts is the only source of internal URLs
supabase/             migrations/ · tests/ · templates/ (auth emails) · config.toml (local stack only)
tests/                repo-level tests (committed .env guard) and stubs; E2E goes in tests/e2e/ (planned)
design/ · scripts/    tokens, logos, design-system PDF · build-tokens, check-bundle, create-admin
docs/ · .claude/      see the table above · launch.json (preview servers), agents/
proxy.ts              session refresh + convenience redirects (never authorization)
vercel.json           region sin1; no Git deploys of `staging` (CI deploys it)
```

- **Import direction:** `app → features → components · hooks · lib · types · content`. Request path: `route.ts` / `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.
- **Thin edges:** routes and actions check access, parse, call a service, respond — no queries or business rules inline. Services take typed values, never `Request` or headers; the caller decides what runs in `after()`.
- **Pages** read through a feature's `dal.ts`, never by fetching our own API.
- **Boundaries:** a feature uses another only through its `service.ts`, types or components — never its `dal.ts`. `lib/` = what every feature shares; `types/` = what a second layer needs; `content/` never imports components. A feature folder is created when its milestone starts (`docs/technical-spec.md` → Planned modules).
- **`hooks/`:** only when a second client component needs the logic; browser behaviour only (no data fetching, theme or screen-size hooks); the rule is a pure, tested function beside the hook. Form state is `<Form>` (`useActionState`).
- **`_components/`** = one route's pieces; move to `components/` when a second route needs one.
- **[server]** files start with `import "server-only"`.
- **Don't introduce:** microservices, GraphQL or a separate backend; global state libraries (Server Components for data, URL params for shareable UI state); folders by file type (`controllers/`, `models/`, `utils/`).

## 4. Routes and rendering

- **Server Actions** for mutations from our pages: one round trip, `refresh()` / `updateTag`, `cookies()`, `redirect()`, work without JS. Never for reading data — they run one at a time.
- **Route Handlers** for webhooks, cron, file downloads, parallel reads (search, polling), external callers, and public anonymous forms that need a stable, rate-limitable URL (`POST /api/v1/leads`).
- **Public and sign-in pages stay ○:** no `cookies()`, `headers()` or `searchParams` in Server Components outside `<Suspense>`.
- **Portal pages stream (◐):** `page.tsx` renders `<Suspense fallback={<WorkspaceSkeleton />}>` around an async component that calls `requireRole` first.
- `usePathname` / `useSearchParams` on a route with an unknown dynamic param suspend: wrap that client component in `<Suspense>` with a non-suspending fallback.
- `createClient()` calls `connection()` first (partial prefetching renders an App Shell with cookies; auth-js reads `Date.now()`).
- Cache with `'use cache'` + `cacheLife`; dedupe per request with React `cache()`.
- `error.tsx` per route group and `global-error.tsx`: a calm message and a way forward, never the error itself.

## 5. Data, validation, errors

- **Data access:** `dal.ts` runs as the signed-in user (`createClient()`), so RLS checks again. Unknown or malformed ids return `null` (→ `notFound()`), never a database error.
- **Secret key** (`createAdminClient()`, read only in `lib/supabase/admin.ts`) bypasses RLS: only in `dal.ts`, only after the caller is authorized, always with a comment saying why.
- **Validation:** Zod, server-side only. Every route and Server Action input has a `z.strictObject` schema and `parseX(input: unknown)` → `{ ok: true, value } | { ok: false, fieldErrors }`, or `{ ok: false, formError }` when no field can fix it (→ `400`). Build on `lib/validation.ts` (example: `features/leads/validation.ts`). Limits live in `contract.ts`, shared with the form's `maxLength`.
- **Errors:** low-level clients throw `UpstreamError` (no user text). Actions log it with its `service` and return a "try again" `SubmitResult`; the route helpers turn it into a `503`. Expected route failures throw `ApiError`. No `any`, empty `catch` or `@ts-ignore`.
- **Untrusted files:** cap size before reading, cap decompressed output and extracted text, never throw out of a parser (`features/users/resume-text.ts` and its zip-bomb test). Server Action body limit: 3 MB.

## 6. Security and auth

- **Access:** every portal page, Server Action and private route calls `requireRole([...])` / `requireUser()` before reading or writing; `proxy.ts` and layouts are never the check. Wrong role → `notFound()`; admin without two-factor → `/mfa`.
- **Server Actions** are public POST endpoints: check auth in each and return a minimal `SubmitResult` — never raw errors, SQL or stack traces.
- **Route Handlers:** JSON writes use `createHandler` (JSON content type → same-site `Origin` → body size → parse → handler); JSON reads use `createGetHandler`. Bodies are `ApiResponse<T>` via `ok()` / `fail()`, typed by the feature's contract, `no-store`. File downloads and `/auth/confirm` are plain GETs: access check first, `404` otherwise, fixed redirects only.
- **Public forms:** honeypot (`website` filled → fake `201`, nothing stored) + Turnstile verified server-side with a hostname check (required in production, test keys refused live; outage → `503`); slow work in `after()`; a Vercel Firewall rate limit per route before launch.
- **Secrets:** server env only via `lib/env.ts`; browser-safe values are `NEXT_PUBLIC_` and read where used. Real values in `.env.local`, never `.env` (`tests/env-file.test.ts`); production keys in Vercel, Sensitive.
- **Privacy:** no PII in URLs, logs, page titles (a person's page is titled "Lead", "Employee") or the audit log; ids are random UUIDs; IPs HMAC-hashed; `404`, not `403`, for what the caller may not see; the Privacy Policy matches what the site does.
- **Headers** (`next.config.ts`): HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, static CSP without nonces; CSP and HSTS in production builds only.
- **Sessions:** `@supabase/ssr` cookies, server-side only; verify with `getClaims()`, never trust `getSession()` on the server.
- **Accounts:** invite-only (sign-up disabled); deactivated, never deleted. `profiles.status`: `invited` → `active` on first sign-in (a VA stays `invited` until an admin approves their profile) → `inactive`. Roles reach the app through the token: `custom_access_token_hook` copies them and `tenant_id` into `app_metadata` (must be enabled in the dashboard); inactive users get none; changes apply at token refresh (≤ 1 h). Who may grant which role, and tenant isolation, are enforced by the database (`supabase/CLAUDE.md`). The app doesn't act on `super_admin` yet — a Super Admin also holds `admin`.
- **Two-factor:** admins and Super Admins need TOTP (`aal2`), checked by `requireRole` and RLS; `/mfa` enrols on first use.
- **Sign-in:** straight to the workspace (`homeFor(roles)`; admins via `/mfa`); `/dashboard` only without a role; `?next=` through `safeNextPath`. One message for credential errors; "forgot password" always reports success. Passwords 10–72 characters, letters and digits.
- **Email links:** invite and reset use `supabase/templates/` token-hash links to `/auth/confirm` (only `invite` / `recovery`).
  - **Temporary until custom SMTP:** default emails carry the session in the URL `#hash`; `/accept-invite` and `EmailLinkSession` read, clear and post it to `establishEmailSession`. Remove all three, and `/accept-invite` from the redirect allow-list, once token-hash emails are live.
- **Content:** never invent testimonials, logos or business claims — real content or `TODO(content)`; placeholder quotes keep a Sample badge (`content/testimonials.ts`).

## 7. Code conventions

| Item | Convention | Example |
|---|---|---|
| Files, folders | kebab-case | `contact-form.tsx` |
| Components | PascalCase, named export | `ContactForm` |
| Functions | camelCase, verb first | `parseLead` |
| Hooks | `useX` in `hooks/use-x.ts` | `useCurrentPath` |
| API routes | plural nouns, versioned | `POST /api/v1/leads` |
| Env vars | SCREAMING_SNAKE; `NEXT_PUBLIC_` only if browser-safe | `RESEND_API_KEY` |
| Tests | `*.test.ts` beside source | `validation.test.ts` |

Server Components by default; `'use client'` on the smallest leaf. Split a file past ~300 lines. Named exports (default only where Next requires); `@/` imports; no barrel files. Comments explain *why*, especially caching choices and non-obvious security checks.

## 8. Performance and testing

| Budget | Target |
|---|---|
| Lighthouse, public pages | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page; sign-in and `/admin` are near it — new client code there needs a saving elsewhere |

- Prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries; justify any dependency over 30 KB; third-party scripts only where needed.
- **Tests:** every `parseX` and pure rule, the route helpers, role rules and `safeNextPath`; database tests per `supabase/CLAUDE.md`. A security test must fail when its rule is removed. Untested auth or permission branches block review.

## 9. Workflow and documentation

- `main` changes only by PR with approval and green CI, using the PR template. Branches `feat/` `fix/` `chore/` `refactor/` `db/`; Conventional Commits.
- PRs under 400 lines (or explained), covering changes, trade-offs, testing, and any env var, dependency or schema change. 1 approval; 2 for database, auth, security or payments.
- **Docs** live only where the table at the top says; `README.md` only points here. A PR that changes a convention, folder, script, env var or decision updates the right file in the same PR. When a planned part is built, its description moves from `docs/technical-spec.md` to the guide that owns it.

## 10. AI agents

- **Ask first:** no code changes without approval — propose plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval every time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, applying migrations, deploying, production data, dashboard settings (Vercel, Supabase, GitHub, Resend, Google), committing secrets. Agents commit only when asked and never print env values or secrets.
- **Workflow:** `software-architect` designs → `devops-security-engineer` assesses → **user approves** → `software-developer` builds → `devops-security-engineer` reviews → **user approves** commit, PR, migration, deploy. The main session runs it and alone talks to the user; each agent's file defines its input and output. Agents get no MCP tools and stop at every gate.
- **Security steps** (assess, review) run when a change touches auth, RLS or grants, secrets, headers, an integration, a dependency or a new service. A small change (typo, copy, one-file fix) skips design.
