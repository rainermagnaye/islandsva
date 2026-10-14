# Features

Loaded when working in `features/`. One business area per folder (today: `auth`, `leads`, `clients`, `users`); a new one is created when its phase starts, never earlier. Project-wide rules are in the root `CLAUDE.md`.

## Anatomy

| File | Side | Holds |
|---|---|---|
| `contract.ts` | shared | Payload/response types, labels, limits. No Zod, so client components can import it. |
| `validation.ts` | server | Zod schemas and `parseX()` |
| `service.ts` | server | Use cases — the business logic routes and actions call. Simple CRUD skips it. |
| `dal.ts` | server | Queries for this feature's tables |
| `actions.ts` | server | Server Actions (`'use server'`); only actions are exported |
| `email.ts` | server | Outbound email |
| `api-client.ts` | client | Browser calls to `/api/v1` |
| `components/` | either | Feature UI |
| `*.test.ts` | — | Beside the file they test |

Request path: `route.ts` or `actions.ts` → `parseX` → `service.ts` → `dal.ts` → `lib/supabase`.

- Import your own files relatively (`./dal`). Another feature only through its `service.ts`, types or components — never its `dal.ts`.
- **Services** take typed values, never `Request` or headers; the caller decides what runs in `after()`.
- **Actions and routes stay thin:** check access, parse, call the service, return. No queries or business rules inline.

## Data access

- Every action starts with `requireRole([...])` (or `requireUser()`); pages do the same before calling `dal.ts`.
- `dal.ts` reads and writes as the signed-in user (`createClient()`, publishable key + session), so RLS checks again.
- The secret key (`createAdminClient()` from `lib/supabase/admin.ts`, the only place it is read) bypasses RLS: only in `dal.ts`, only after the caller is authorized, always with a comment saying why. Typical uses: the anonymous contact form, writes the API mustn't reach (résumé bytes, registration progress), Auth admin calls.
- Per-request dedupe with React `cache()` (e.g. counts shared by the sidebar badge and a page).
- Unknown or malformed ids return `null` (→ `notFound()`), never a database error.

## Validation

- Zod, server-side only. Each input gets a `z.strictObject` schema and a `parseX(input: unknown)` returning `{ ok: true, value } | { ok: false, fieldErrors }`, or `{ ok: false, formError }` when no field can fix it (unknown keys, not an object, tampered hidden input → `400`). Build on `lib/validation.ts` (`parseWith`, `emailField`, `toSubmitResult`). Example: `leads/validation.ts`.
- Every route and Server Action validates this way — TypeScript types are not runtime checks.
- Limits live in `contract.ts` (shared with the form's `maxLength`) and are mirrored by database `CHECK` constraints.

## Errors

- Low-level clients throw `UpstreamError` (no user-facing text). Actions catch it, log it with its `service`, and return a "try again" `SubmitResult`; routes let `createHandler` turn it into a `503`.
- Actions return a minimal `SubmitResult` (`types/form.ts`) — never raw errors, SQL or stack traces.
- No `any`, no empty `catch`, no `@ts-ignore`.

## Untrusted files

Uploads (e.g. résumés): cap the size before reading; cap decompressed output and extracted text; never throw out of a parser — a bad file is stored or rejected, not a crash. See `users/resume-text.ts` and its zip-bomb test. The Server Action body limit is 3 MB (`next.config.ts`).

## Tests

Every `parseX` and every pure rule (triage flow, registration steps, invite results, parsers) has a `*.test.ts` beside it.
