@AGENTS.md

# Islands VA — Engineering Guide

Rules for the team and AI agents; change them by PR. Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before using a Next API.

This file holds what applies everywhere. Area detail lives next to its code and loads only when you work there:

| Working in | Read |
|---|---|
| `app/` — routes, pages, rendering, Server Actions vs Route Handlers | `app/CLAUDE.md` |
| `features/` — feature anatomy, data access, validation, errors, uploads | `features/CLAUDE.md` |
| `features/auth/` — sessions, roles, two-factor, email links | `features/auth/CLAUDE.md` |
| `lib/api/` — `createHandler`, API responses, public forms | `lib/api/CLAUDE.md` |
| `components/` — design system, tokens, voice | `components/CLAUDE.md` |
| `supabase/` — migrations, grants, RLS, access model, database tests | `supabase/CLAUDE.md` |
| Setup, applying migrations, launch · decisions · roadmap and pending work | `docs/operations.md` · `docs/decisions.md` · `docs/roadmap.md` |

## 1. Project

- **Product:** B2B virtual-assistant staffing platform — public site, client/VA portal, agency back office. Scope: `Island-VA-MVP.docx`.
- **Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind v4, `cacheComponents`, `partialPrefetching`) · Supabase (Singapore) · Vercel · Resend · Cloudflare Turnstile. Runtime deps: `next`, `react`, `react-dom`, and server-only `zod`, `@supabase/ssr`, `@supabase/supabase-js` (none reach the browser).
- **Priorities:** secure → correct → maintainable → performant.
- **Phase:** M2 — auth, role dashboards, admin system (`docs/roadmap.md`). **Build only the current phase.** Not in the MVP: blog, chatbot, client rating, VA mailer, salary deductions, Staff module, native apps, i18n.
- **Domain:** roles Client, VA, Closer, Admin (a user can hold several). *Lead* = contact-form submission. *Client* = a company record, `pending` until activated; it gets a login only when invited. *Staff* = VA, Closer or Admin. Accounts are invite-only, and deactivated, never deleted.

## 2. Commands

```bash
npm run dev          # http://localhost:3000 — one dev server per folder (a second exits)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (run `npx next typegen` first in a fresh checkout)
npm test             # Vitest: validators, helpers, createHandler, roles, every migration + RLS policy (PGlite)
npm run build        # every public route must stay ○ (static)
npm run size         # after build: first-load JS per page vs the §6 budget (exit 1 if over)
npm run start        # serve the production build
npm run tokens       # regenerate app/tokens.css from design/tokens.json
npm run admin:create -- <email>        # make an account admin in the project .env.local points at
npx supabase migration new <name>      # new SQL file in supabase/migrations/
```

`lint`, `typecheck`, `test` and `build` must pass before every push — run them one after another (the PGlite suite can starve in parallel). No `format` script or CI yet.

**Gotchas:** `next build` while `next dev` runs in the same folder leaves the dev server serving stale CSS — restart it, or build in a separate `git worktree`. Windows paths in `node_modules` can exceed 260 characters; delete such folders with `\\?\`-prefixed paths.

## 3. Architecture

```
app/                  routes only — thin pages and endpoints ((marketing) · (auth) · (dashboard) · auth/confirm · api/v1)
features/<feature>/   one business area: contract · validation · service · dal · actions · components (auth, leads, clients, users)
components/           shared UI: ui/ (design system) · layout/ · marketing/
hooks/                [client] shared browser hooks, `use-x.ts` (today: use-current-path)
lib/                  shared infrastructure: api/ · auth/ (roles, session) · supabase/ (server, admin, proxy) · validation · env
types/                shared types only (api, form, icon, database)
content/              typed static content; content/routes.ts is the only source of internal URLs
supabase/             migrations/ · tests/ · templates/ · config.toml (local stack only)
design/ · scripts/    tokens, logo sources, design-system PDF · build-tokens, check-bundle, create-admin
docs/                 runbooks, decisions, roadmap (for people; not loaded automatically)
proxy.ts              session refresh + convenience redirects (never authorization)
```

**Import direction:** `app → features → components · hooks · lib · types · content`. Request path: `route.ts` / `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.

- **Thin edges:** routes and actions parse, check access, call a service, respond. Pages read through a feature's `dal.ts` — never `fetch` our own API from the server.
- **Boundaries:** a feature uses another only through its `service.ts`, types or components, never its `dal.ts`. `lib/` holds only what every feature shares; `types/` only what a second layer needs; `content/` never imports components. New features get a folder when their phase starts.
- **`hooks/`:** only when a second client component needs the logic; browser behaviour only — no data fetching, theme or screen-size hooks. Keep the rule a pure, tested function beside the hook. Form pending/error state is `<Form>`, not a hook.
- **Mutations:** Server Actions from our own pages; Route Handlers for webhooks, external callers and public forms (`app/CLAUDE.md`).
- **[server]** files start with `import "server-only"`.

**Fixed — don't introduce:** microservices, GraphQL or a separate backend; global state libraries (use Server Components for data, URL search params for shareable UI state); folder-per-file-type structure (`controllers/`, `models/`, `utils/`).

## 4. Security (everywhere)

- **Every portal page and Server Action checks access first** with `requireRole([...])` / `requireUser()` (`lib/auth/session.ts`); data then runs under RLS as that user. `proxy.ts` and layouts are never the check. Wrong role → `404`; admins need two-factor sign-in (`aal2`).
- **Every Server Action and Route Handler** validates all input with the feature's `parseX` and returns a minimal result — never raw errors, SQL, stack traces or secrets.
- **Secrets** stay on the server: env only through `lib/env.ts`; the secret key only in `dal.ts`, after the caller is authorized; nothing secret in `NEXT_PUBLIC_` or `.env`. No Supabase client in the browser.
- **No PII in URLs, logs or page titles.** Ids in URLs are random UUIDs. `404`, not `403`, for what the caller may not see.
- **Content:** never invent testimonials, logos or business claims — real content or `TODO(content)`.

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

- Server Components by default; `'use client'` only on the smallest leaf that needs it. ~200 lines per file. Named exports (default only where Next requires); `@/` imports; no barrel files.
- Zod validation server-side only; limits in `contract.ts`, mirrored by database constraints (`features/CLAUDE.md`).
- No `any`, no empty `catch`, no `@ts-ignore`.
- **Comments** explain *why* — required on secret-key queries, caching choices and non-obvious security checks.

## 6. Performance and testing

| Budget | Target |
|---|---|
| Lighthouse, public pages (all four) | ≥ 95 |
| LCP · CLS · INP | < 2.0 s · < 0.05 · < 200 ms |
| First-load JS | ≤ 160 KB gzipped per page (`npm run size`). Now: public ~148, contact 155, sign-in ~158, `/admin` 158.9 — new client code there needs a saving elsewhere |

- Keep client components minimal; prefer platform features (CSS, `<details>`, `<dialog>`, popover) over libraries. Justify any dependency over 30 KB. `next/font` (≤ 2 families); third-party scripts only on the pages that need them.
- **Tests:** every `parseX` and pure rule; `createHandler`; role rules and `safeNextPath`; every migration with RLS allowed and denied per role. A test for a security limit must fail when the limit is removed. Untested auth or permission branches block review.

## 7. Workflow and documentation

- `main` changes only by PR with approval (plus green CI once it exists). Branches `feat/` `fix/` `chore/` `refactor/` `db/`, short-lived; Conventional Commits (`feat(contact): add lead form`).
- PRs under 400 lines, describing changes, trade-offs, testing and any env var, dependency or schema change. 1 approval; 2 for database, auth, security or payments.
- **Where documentation lives:** this file = rules that apply everywhere and the map; a folder's `CLAUDE.md` = that area's rules (loaded only when working there); `docs/` = runbooks, decisions and roadmap for people. Each fact in exactly one place — link, don't copy. `README.md` only points here; no other READMEs or doc folders.
- A PR that changes a convention, folder, script, env var or decision updates the nearest `CLAUDE.md` or `docs/` file in the same PR.

## 8. Rules of engagement (AI agents)

- **Ask first:** no code changes without approval — propose the plan, trade-offs, dependencies and risks, then wait.
- **Explicit approval each time:** migrations, deploys, security fixes, auth changes, major upgrades.
- **Humans only:** merging PRs, pushing to `main`, touching production data, committing secrets.
- Don't commit unless asked. When unsure about a Next.js 16 API, read the bundled docs.
