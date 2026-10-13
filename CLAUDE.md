@AGENTS.md

# Islands VA — Engineering Guide

Rules for the team and AI agents; change them by PR. Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before using a Next API.

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, client/VA portal, agency back office. Scope: `Island-VA-MVP.docx`.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel · Resend · Cloudflare Turnstile. Runtime deps: `next`, `react`, `react-dom`, `zod` (server-only).
- **Priorities:** secure → correct → maintainable → performant.
- **Phases:** **M1 public site (current):** 9 marketing pages, a `/login` placeholder and `POST /api/v1/leads` → M2 auth + role dashboards → M3 Closer onboarding → M4 packages + payments (1/6/12 months) → M5 client view + demo booking → M6 VA client list + 1-call rule → M7 admin lists + sales summary.
- **Build only the current phase.** Not in MVP: blog, chatbot, client rating, VA mailer, salary deductions, Staff module, native apps, i18n.
- **Domain:** roles Client, VA, Closer, Admin (a user can hold several). *Lead* = contact-form submission. *Client profile* = created by a Closer, inactive until activated. Accounts are invite-only.

## 2. Commands

```bash
npm run dev          # http://localhost:3000
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # every public route must stay ○ (static)
npm run start        # serve the production build
npm run size         # after build: first-load JS per page vs the §8 budget (exit 1 if over)
npm run tokens       # regenerate app/tokens.css from design/tokens.json
```

`lint`, `typecheck` and `build` must pass before every push. There is no `test` or `format` script and no CI yet (§11).

## 3. Architecture

```
app/                  routes only — thin pages and endpoints
  (marketing)/        static public site; page-only layout UI in <page>/_components/
  api/v1/<resource>/  Route Handlers — the HTTP API
features/<feature>/   one business area in one place (today: leads)
  contract.ts         [shared] payload/response types + limits — no Zod, safe for client imports
  validation.ts       [server] Zod schema + parseX()
  service.ts          [server] use cases — the business logic routes and actions call
  dal.ts              [server] queries for this feature's tables
  email.ts            [server] outbound email
  actions.ts          [server] Server Actions ('use server') — none yet
  api-client.ts       [client] browser calls to /api/v1
  components/         feature UI (e.g. contact form)
components/           shared UI: ui/ (design system) · layout/ (shell, nav, footer) · marketing/ (sections)
lib/                  shared infrastructure: api/ (createHandler, ApiError, ok/fail, Turnstile, IP hash) · supabase/ · env · upstream-error · cx
types/                shared types only (api.ts, form.ts, icon.ts, turnstile.d.ts; database.ts generated from M2)
vercel.json           function region sin1 (next to Supabase)
content/              typed static content and routes
design/ · scripts/    design tokens and their build script
```

M2 adds `(auth)/login` and `(dashboard)/client · va · admin`, each with its own layout; new features get a folder when their phase starts, never earlier.

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
- **Rendering:** public pages stay static — no `cookies()`, `headers()` or `searchParams` in Server Components; request-time reads go inside `<Suspense>`. Cache with `'use cache'` + `cacheLife`.
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

- **Secrets:** real values in `.env.local` (git-ignored); `.env.example` lists every key, empty. Server env is read only through `lib/env.ts`; a missing key fails just that request (`503`). `SUPABASE_SECRET_KEY` bypasses RLS — used only in `lib/supabase/rest.ts`, called only from `dal.ts` files. Production secrets live in Vercel, marked Sensitive.
- **Every Route Handler uses `createHandler`**, which checks in order: JSON content type and same-site `Origin` (CSRF), body size, then the handler. Each route then validates with `parseX`, authorizes the specific resource (M2+), and returns a minimal response.
- **Every Server Action** is a public POST endpoint, reachable without our UI: check authentication and authorization inside each one, validate every argument with `parseX`, return a minimal `SubmitResult`, never raw errors. Only actions are exported from `actions.ts`. Next.js adds an `Origin` check and a 1 MB body limit.
- Rate limiting: a Vercel Firewall rule per route (required before launch; not configured yet). Public forms: honeypot (bots get a fake `201`) + Turnstile, rendered explicitly (survives client-side navigation) and verified server-side, including the token's hostname. Required in production, skipped in local dev without a secret; Cloudflare's test keys work everywhere except the live deployment. A Cloudflare outage is a `503`, not a failed check.
- No stack traces, SQL, PII or secrets in responses or URLs. Return `404`, not `403`, for resources the caller may not see.
- Headers in `next.config.ts`: HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, and a static CSP without nonces (nonces would break static rendering). CSP/HSTS apply to production builds only.
- Privacy: IPs are HMAC-hashed before storage; the Privacy Policy must match what the site actually does.
- **M2 auth:** `@supabase/ssr` cookie sessions (`HttpOnly`, `Secure`, `SameSite=Lax`); verify with `getClaims()`, never trust `getSession()` on the server; `proxy.ts` is not an authorization layer; MFA for admins; invite links hashed, single-use, expiring; "inactive until activated" enforced in RLS and the API.

## 7. Database

- Hosted Supabase over REST; no `supabase/` folder or local Docker yet (revisit at M2).
- Schema changes are written as SQL, reviewed in a PR, and applied by a human — staging first, then production. No unrecorded dashboard edits.
- RLS on every table. Server-only tables: zero policies + `REVOKE ALL … FROM anon, authenticated`. Others: explicit per-role policies, each tested allowed and denied.
- Invariants as constraints (`CHECK`, unique, FKs); index FKs and RLS columns. Changes are forward-only.

## 8. Performance & testing

| Budget (public pages) | Target |
|---|---|
| Lighthouse (all four) | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page, checked by `npm run size` (framework baseline ~145 KB; contact ~151 KB) |

- Keep client components minimal; prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries. Justify any dependency over 30 KB.
- Images: `getImageProps()` + `<img>`/`<picture>` in Server Components (optimised, 0 KB client JS — `<Image>` adds ~5 KB per page); a `<picture>` `prefers-color-scheme` source for themed images so only one downloads. `next/font` (≤ 2 families); third-party scripts only on the pages that need them.
- Tests (once a runner is approved): every `parseX` and `createHandler`; every Server Action's auth check; each endpoint's status codes; RLS allowed/denied per role (M2+); E2E for navigation, both themes and the contact form. Untested auth or permission branches block review.

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
| Supabase via REST `fetch`, no `supabase-js` or `supabase/` folder | No dependency for one table | Start of M2 |
| Static CSP without nonces | Keeps public pages static | M2 dashboard routes |
| Theme follows the OS, no toggle | No script or cookie | — |
| Rate limiting in Vercel Firewall | No extra service | Per-user limits in M2 |
| `features/` + shared `lib/` | Each business area in one place as the app grows | — |
| Invite-only accounts | B2B: Closers create clients; staff are invited | — |

## 11. Pending (parked, not blocking)

- **Setup:** decide where the `leads` table SQL lives.
- **Repo & tooling:** first commit + GitHub remote; CI running lint, typecheck, build and `npm run size`; Prettier; `--max-warnings=0`; pin Node 24; test runner (Vitest).
- **Launch:** create the `leads` table and set keys; create the Vercel project (region comes from `vercel.json`) + rate-limit rule.
- **Code:** content accessors (`getPackages()`); rename `monthlyPriceCents` / `package_slug` before the table exists; `type-*` instead of arbitrary font sizes.
- **Content & legal:** prices, contact email, About story, legal review, privacy policy accuracy; hide Testimonials/Brands until real content exists.

## 12. Rules of engagement (AI agents)

- **Ask first:** no code changes without approval — propose the plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval each time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, touching production data, committing secrets.
- Don't commit unless asked. When unsure about a Next.js 16 API, read the bundled docs.
