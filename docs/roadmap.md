# Roadmap

## Phases

1. **M1 — public site** (done): 9 marketing pages and `POST /api/v1/leads`.
2. **M2 — auth, role dashboards, admin system** (done): sign-in with roles and admin two-factor, the admin overview, leads (filters, triage, convert to client), clients, Teams and staff profiles, the shared workspace menu, header search.
3. **M3 — client onboarding and activation** (done): the Closer's client list and profiles; the registration packet (link, business and billing details, signature, payment proof), copied by an admin or the client's Closer; the admin review (approve or send back); "Send activation" (the password invite); the client becomes active on their first sign-in. Admins assign the client's VA.
4. **M4 — packages and payments** (paused): Stripe and 1/6/12-month billing. Until then payment is manual: the client uploads proof in the packet and an admin checks it in the review.
5. **M5 — client view and demo booking** (done): the client dashboard (VA, package) and booking or cancelling one 30-minute demo call on a VA's open slot.
6. **M6 — VA workspace and the 1-call rule** (done): the VA dashboard and client list, the VA's demo calendar (30-minute slots), confirming or declining requests; one open demo per client, enforced by the database.
7. **M7 — admin lists and sales summary** (current): the demo calls list is done; the sales summary (gross, net, revenue) needs a decision first on where payment amounts come from, since the packet stores a proof file, not an amount.

Then launch: the checklist in `docs/operations.md`.

What is not in the MVP is a rule for every change, so it lives in `CLAUDE.md` §1.

## Pending (parked, not blocking)

- **Supabase:** production settings, custom SMTP (Resend) and the two `supabase/templates/` — steps 1–5 in `docs/operations.md` — then remove the temporary hash-link invite flow (`CLAUDE.md` §6); regenerate `types/database.ts` (hand-written until then). Package pricing per term is decided in M4; `packages` has no seed rows until then. A separate staging Supabase project, so staging and PR previews stop sharing live data (setup: `docs/operations.md` → Staging).
- **Repo and tooling:** make CI a required check — branch protection (paid plan) or the free CODEOWNERS + Actions guard; Prettier (editors already reformat on save — agree on it before reformatting lands in PRs); `--max-warnings=0`; pin Node 24 (`.nvmrc` + `engines`); Playwright E2E (`tests/e2e/`) for navigation, both themes, the contact form and sign-in.
- **Launch:** see the checklist in `docs/operations.md`.
- **Code:**
  - A cleanup migration for what the registration packet replaced: `client_onboarding_links`, `payments` and their functions (`issue_onboarding_link`, `submit_onboarding`, `record_manual_payment`, `void_payment`, `activate_client`) are live but unused.
  - One list of custom error codes: the registration-packet functions reuse `IVA06`–`IVA09` with meanings that differ from the earlier ones.
  - Demo screens: use the design system's DatePicker and TimeSlotPicker (`components/ui/`) instead of native inputs.
  - Decide whether client↔VA tasks are in the MVP (`ui/task-list.tsx` exists; there's no table or screens).
  - After a confirmed demo, an in-app next step for the client (today only the email says it).
  - Content accessors (`getPackages()`); rename `monthlyPrice` → `monthlyPriceCents`; `type-*` instead of arbitrary font sizes.
  - Resend and revoke invites.
  - Tenants in the app (the database is ready): act on `super_admin` in `lib/auth/roles.ts` and `requireRole`; offer "Admin" in the invite form only to Super Admins (the database refuses anyone else); Super Admin screens (tenants, cross-tenant lists); invites and the contact form choose a tenant once there is more than one.
- **Content and legal:** prices, contact email, About story, client testimonials and logos (with written consent), legal review, privacy policy accuracy.
