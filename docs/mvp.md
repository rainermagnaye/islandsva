# Islands VA — MVP plan

What ships, in order, and what is parked. Why: `docs/prd.md`. How: `docs/technical-spec.md`.

Done means: works for every role it touches, RLS allowed and denied tests, CI green.

## Milestones

| # | Milestone | Ships | Status |
|---|---|---|---|
| M1 | Public site | 9 pages, contact form, lead email | Done |
| M2 | Auth + admin | Sign-in, reset, invites, admin 2FA; leads, clients, Teams, search | Done |
| M3 | Onboarding | Registration packet, admin review, activation | Done |
| M5 | Client view | Client dashboard; VA demo booking (replaced by intro calls in M10) | Done |
| M6 | VA workspace | VA dashboard, client list, slot calendar | Done |
| M7 | Admin lists | Demo calls list ✅ · sales summary from contracted value (`clients.monthly_cents`) ⏳ | Current |
| M8 | Discovery calls | `meetings` + history; admin sets daily times (PHT, every day, max 6); slot picker on the contact form (built); Lead Gen inbox, confirm (takes ownership) / reject, outcomes; Lead Gen schedule, call history and activity log; audit log (database triggers); leads move from admin to Lead Gen | In progress — started before M7 closed (user decision); database slices built: 1 (times, meetings, history, inbox) and 2 (audit log, including tasks and VA shortlists) |
| M14 | Timesheets | VA play / pause timer per client (replaces the task timer); daily target = package hours ÷ 5; hours per day, week and month and the remaining weekly and monthly balance, live; session history; client validates each day at month end (approve or dispute), admin resolves disputes, undecided days auto-approve after 5 days. Numbered M14 so existing references keep theirs; built after M8 | In progress — started before M8 closed (user decision); slice 0 removes the task timer |
| M9 | Google | Employees connect their own Google account; confirm creates a Calendar event + Meet link and invites the attendee; reschedule and cancel sync both ways; start Google's app verification | |
| M10 | VA Match | Admin shortlist; VA working hours + Google free/busy; client accepts or requests an intro call (the VA confirms); accept assigns the VA; several VAs per client; demo tables retired | |
| M11 | Tasks + performance | Client tasks with deadlines, status, comments; VA task list; tasks done, on-time rate, overdue | |
| M12 | Client↔VA meetings | For active clients and their assigned VAs: client or VA schedules (open-ended length, booked at once with Meet); reschedule, cancel, done / no-show; schedule pages; history and notes | |
| M13 | Admin overview | Pipeline, calls and meetings, Lead Gen results, clients, VAs, packages, contracted revenue, employees without Google; full audit log with filters | |
| — | Launch | Checklist below | |

M4 (Stripe) is no longer an MVP milestone; payment stays manual (proof in the registration packet, checked by an admin).

## Packages

Placeholder prices per month — TODO(content).

| Package | Hours/week | 1 mo | 6 mo | 12 mo |
|---|---|---|---|---|
| Essentials | 20 | $900 | $855 | $810 |
| Executive | 40 | $1,600 | $1,520 | $1,440 |
| Day and night | 80 | $3,000 | $2,850 | $2,700 |

## Launch checklist

Runbook: `docs/operations.md`.

- [ ] M7–M14 done
- [ ] Supabase production settings, Resend SMTP, email templates; remove the temporary invite flow
- [ ] Google OAuth app (External) verified for sensitive scopes — unverified, employee connections expire every 7 days; every Lead Gen and VA connected
- [ ] Firewall rate limits on the lead and slot endpoints (`POST /api/v1/leads`, `GET /api/v1/discovery-slots`) and the sign-in POSTs — the contact form books from a small set of daily slots, so these are what stop one visitor holding them all
- [ ] Turnstile production keys; production env vars marked Sensitive
- [ ] Privacy policy names Google (Calendar and Meet); legal review; real content

## After launch

Call reminders (Vercel cron) · upsell and retention flags from hours used · Stripe · client rating · blog · chatbot.

## Parked (not blocking)

- **Supabase:** a separate staging project, so staging and PR previews stop sharing live data (`docs/operations.md` → Staging); regenerate `types/database.ts` (hand-written until then).
- **Repo and tooling:** make CI a required check (branch protection on a paid plan, or CODEOWNERS + an Actions guard); Prettier (agree before reformatting lands in PRs); `--max-warnings=0`; pin Node 24 (`.nvmrc` + `engines`); Playwright E2E (`tests/e2e/`) for navigation, both themes, the contact form and sign-in.
- **Code:**
  - Cleanup migration for what the registration packet replaced: `client_onboarding_links`, `payments` and their functions (`issue_onboarding_link`, `submit_onboarding`, `record_manual_payment`, `void_payment`, `activate_client`).
  - One list of custom error codes: the registration-packet functions reuse `IVA06`–`IVA09` with different meanings.
  - Meeting screens: use the design system's DatePicker and TimeSlotPicker (`components/ui/`) instead of native inputs.
  - Content accessors (`getPackages()`); rename `monthlyPrice` → `monthlyPriceCents`; `type-*` instead of arbitrary font sizes.
  - Resend and revoke invites.
  - Tenants in the app (the database is ready): act on `super_admin` in `lib/auth/roles.ts` and `requireRole`; offer "Admin" in the invite form only to Super Admins; Super Admin screens; invites, the contact form and discovery-call times choose a tenant once there is more than one.
- **Content and legal:** prices, contact email, About story, client testimonials and logos (with written consent), legal review.
