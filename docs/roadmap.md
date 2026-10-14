# Roadmap

## Phases

1. **M1 — public site** (done): 9 marketing pages and `POST /api/v1/leads`.
2. **M2 — auth, role dashboards, admin system** (current): sign-in with roles and admin two-factor, the admin overview, leads (filters, triage, convert to client), clients, Teams and staff profiles.
3. **M3** — Closer onboarding: client profiles, onboarding forms, client invites, activation.
4. **M4** — packages and payments (1/6/12-month terms).
5. **M5** — client view and demo booking.
6. **M6** — VA client list and the 1-call rule.
7. **M7** — admin lists and sales summary.

What is not in the MVP is a rule for every change, so it lives in `CLAUDE.md` §1.

## Pending (parked, not blocking)

- **Supabase:** disable sign-ups; production Site URL and redirect URLs; custom SMTP (Resend) and the two `supabase/templates/`, then remove the temporary hash-link invite flow (`features/auth/CLAUDE.md`); regenerate `types/database.ts` (hand-written until then). Package pricing per term is decided in M4; `packages` has no seed rows until then.
- **Repo and tooling:** CI running lint, typecheck, test, build and `npm run size`; branch protection (paid plan) or the free CODEOWNERS + Actions guard; Prettier (editors already reformat on save — agree on it before reformatting lands in PRs); `--max-warnings=0`; pin Node 24 (`.nvmrc` + `engines`); Playwright E2E (`tests/e2e/`) for navigation, both themes, the contact form and sign-in.
- **Launch:** see the checklist in `docs/operations.md`.
- **Code:**
  - `leads (created_at desc)` index for the unfiltered leads list (migration).
  - Move the staff profile form and the Disable dialog onto `<Form>`.
  - Split the icon set to win back ~1.2 KB per page (`/admin` is at 158.9 of 160 KB).
  - Content accessors (`getPackages()`); rename `monthlyPrice` → `monthlyPriceCents`; `type-*` instead of arbitrary font sizes.
  - Resend and revoke invites.
- **Content and legal:** prices, contact email, About story, client testimonials and logos (with written consent), legal review, privacy policy accuracy.
