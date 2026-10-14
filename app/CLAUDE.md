# Routes and pages

Loaded when working in `app/`. Routes stay thin: compose components, read data through a feature's `dal.ts`, call its actions. Never `fetch` our own API from the server.

## Route groups

- `(marketing)/` — the static public site; page-only layout pieces in `<page>/_components/`.
- `(auth)/` — sign-in screens: login · forgot-password · set-password · mfa · accept-invite (temporary — `features/auth/CLAUDE.md`).
- `(dashboard)/` — the portal: `dashboard` (fallback) · `client` · `va` · `closer` · `admin` (admins only; sidebar layout: overview · leads + lead page · clients · users = Teams + staff profile page).
- `auth/confirm/` — email-link landing. `api/v1/<resource>/` — Route Handlers (`lib/api/CLAUDE.md`).
- `_components/` holds one route's pieces; move to `components/` when a second route needs one.

## Rendering

- Public and sign-in pages stay **static** (○ in `npm run build`): no `cookies()`, `headers()` or `searchParams` in Server Components outside `<Suspense>`.
- Portal pages are a **static shell with the session part streamed** (◐): `page.tsx` renders `<Suspense fallback={<WorkspaceSkeleton />}>` around an async component that calls `requireRole` first.
- `usePathname` / `useSearchParams` on a route with an unknown dynamic param (e.g. `/admin/leads/[id]`) suspend: wrap the client component in `<Suspense>` with a fallback that doesn't suspend.
- Cache with `'use cache'` + `cacheLife` (e.g. the footer year); per-request dedupe with React `cache()`.
- After `PageProps<"/route">` / `LayoutProps` type errors in a fresh checkout or for a new route, run `npx next typegen`.

## Access

- Every portal page and Server Action calls `requireRole([...])` / `requireUser()` before reading or writing. Layouts and `proxy.ts` never decide access (a layout may hide UI, e.g. the new-leads badge, but the page still checks).
- Titles of pages about a person stay generic ("Lead", "Staff") — names stay out of tab titles and history.

## Server Actions vs Route Handlers

- **Server Actions** — mutations from our own pages that should update the UI at once (portal forms, sign-in/out, admin actions): one round trip, `refresh()` / `updateTag`, `cookies()`, `redirect()`, work without JS. Mutations only: they run one at a time, so never fetch data with them.
- **Route Handlers** — webhooks, cron, downloads, parallel reads (search, polling), external callers, and public anonymous forms that need a stable, rate-limitable URL.

## Errors

Route-level UI errors use `error.tsx` per route group and `global-error.tsx`; they show a calm message and a way forward, never the error itself.

## Security headers

Set in `next.config.ts`: HSTS, nosniff, strict referrer, restrictive `Permissions-Policy`, no framing, and a static CSP without nonces (nonces would make every page dynamic). CSP and HSTS apply to production builds only.
