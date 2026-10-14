# HTTP API

Loaded when working in `lib/api/`. Route files live in `app/api/v1/<resource>/route.ts` (plural nouns, versioned). Use a Route Handler only for what Server Actions don't fit — see `app/CLAUDE.md`.

## `createHandler` (`handler.ts`)

Every JSON Route Handler is wrapped in it. In order: `application/json` content type → same-site `Origin` (CSRF; Route Handlers have no built-in protection) → body size (header and actual bytes) → JSON parse → your handler. Then:

- `ApiError` → its status and code via `fail()`.
- `UpstreamError` → logged, `503` with the route's `unavailableMessage`.
- Anything else → logged, generic `500`.

Inside the handler: validate with the feature's `parseX`, authorize the specific resource, call the service, return a minimal response.

## Responses (`response.ts`, `types/api.ts`)

- Every body is `ApiResponse<T>`: `{ data }` or `{ error: { code, message, fieldErrors? } }`, built only with `ok()` / `fail()`, `data` typed by the feature's contract (`ok<LeadCreated>(…)`).
- All API responses are `Cache-Control: no-store`.
- No stack traces, SQL, PII or secrets. `404`, not `403`, for resources the caller may not see.

## Public forms (the contact form → `POST /api/v1/leads`)

- **Honeypot** (`website` field): filled → a fake `201`, nothing stored.
- **Turnstile** (`turnstile.ts`): rendered explicitly on the page (survives client-side navigation), verified server-side including the token's hostname. Required in production; skipped in local dev without a secret; Cloudflare's test keys refused on the live deployment. A Cloudflare outage is a `503`, not a failed check.
- **IP addresses** are HMAC-hashed (`ip-hash.ts`, key imported once) before storage — never stored raw. The privacy policy must match.
- Slow side effects (email) run in `after()` so the visitor never waits on them.
- **Rate limiting:** a Vercel Firewall rule per route — required before launch, not configured yet (`docs/roadmap.md`).
