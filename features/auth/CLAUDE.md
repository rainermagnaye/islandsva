# Auth

Loaded when working in `features/auth/`. Related code: `lib/auth/` (`roles.ts`, `session.ts`), `lib/supabase/`, `proxy.ts`, `app/(auth)/`, `app/auth/confirm/`. Database side of users and roles: `supabase/CLAUDE.md`.

## Sessions

- `@supabase/ssr` cookie sessions, server-side only — no Supabase client in the browser.
- Verify with `getClaims()` (checks the token signature); never trust `getSession()` on the server. `getSessionUser()` is cached per request.
- `createClient()` calls `connection()` first: partial prefetching renders an App Shell with cookies, and auth-js checks expiry with `Date.now()`.
- `proxy.ts` refreshes the session cookie on auth and portal routes and redirects for convenience only — never the access check.

## Accounts and roles

- Invite-only; sign-up is disabled. Admins invite staff (Teams page); Closers will invite clients (M3).
- Supabase Auth owns `auth.users`; `profiles` (same id) holds our side. `profiles.status`: `invited` → `active` on first sign-in → `inactive` when deactivated. Accounts are deactivated, never deleted.
- Roles live in `roles` (one row per user per role; `app_role` = `ROLES` in `lib/auth/roles.ts`, highest precedence first), written only by the server.
- The `custom_access_token_hook` copies roles into `app_metadata.roles` (never `user_metadata`, which users can edit); inactive users get none. Role changes apply at the next token refresh (≤ 1 hour). The hook must be enabled in the Supabase dashboard — without it nobody gets a role.
- `requireRole` / `requireUser` (`lib/auth/session.ts`): wrong role → `notFound()`; an admin without two-factor → `/mfa`.

## Two-factor

Admins need TOTP (`aal2`), enforced by `requireRole` and again by RLS. `/mfa` sets up an authenticator app on first use, then asks for a code each sign-in.

## Sign-in flow

- After sign-in, users go straight to their workspace (`homeFor(roles)` from the new token); admins pass through `/mfa`. `/dashboard` is only the fallback for an account without a role.
- `?next=` goes through `safeNextPath` (same-site paths only — no open redirect).
- Credential errors share one message and "forgot password" always reports success (no account enumeration).
- Passwords: 10–72 characters with letters and digits.

## Email links

- Invite and reset emails use the `supabase/templates/` token-hash links to `/auth/confirm` — the one GET route outside `createHandler`. It accepts only `invite` / `recovery`, verifies the token server-side and redirects to fixed paths.
- **Temporary (until custom SMTP):** the hosted project still sends Supabase's default emails, whose links carry the session in the URL `#hash`. `/accept-invite` and `EmailLinkSession` (in the root layout, so on every page) read and clear the hash and post the tokens to `establishEmailSession`, which stores them with `setSession` (Supabase validates them). Remove all three, and `/accept-invite` from the redirect allow-list, once the token-hash emails are live (`docs/roadmap.md`).
