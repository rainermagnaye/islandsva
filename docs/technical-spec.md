# Islands VA — Technical spec

The domain model, status flows and integrations. Stack, layers, folder map and coding rules: `CLAUDE.md`. Database rules: `supabase/CLAUDE.md`. Why each choice: `docs/decisions.md`.

## Data model

| Table | Holds | Status |
|---|---|---|
| tenants · profiles · roles | Agencies; accounts; roles per user | Built |
| employee_profiles | VA and Lead Gen details, résumé, avatar, references | Built |
| leads · lead_events | Enquiries and timeline; `owner_id` = the Lead Gen who confirmed the call | Built; add owner (M8) |
| discovery_times | Admin-set daily times of day (PHT), at most 6 active | New (M8) |
| meetings | Every call: kind, organizer, scheduled by, attendees, start, end, status, Google event id, Meet link | New (M8–M9) |
| meeting_events | Meeting history: scheduled, rescheduled (old → new), cancelled (by whom, app or Google), done, no-show, note | New (M8–M9) |
| google_connections | An employee's encrypted refresh token, calendar id, push channel | New (M9) |
| va_working_hours | A VA's weekly hours (PHT) when clients may request meetings | New (M10) |
| clients · client_packets · client_notes | Company and package; registration; notes | Built |
| va_shortlists | Client ↔ shortlisted VA, status (offered, accepted, declined) | New (M10) |
| client_va_assignments | Client ↔ VA | Built; allow several active VAs (M10) |
| tasks · task_comments | Client, VA, title, deadline, status, comments | New (M11) |
| audit_log | Append-only: actor (user, Google sync or system), action, record type + id, owning Lead Gen / client, before → after (changed fields only, no PII), at | New (M8) |
| demo_slots · demo_bookings | Client ↔ VA demo calls | Built; replaced by `meetings` (intro calls), drop in M10 |
| client_onboarding_links · payments | Replaced by the registration packet | Drop |

## Meetings

One model for every call; one Google integration; one history.

| Kind | Organizer (whose Google calendar) | Invited | Booking rule |
|---|---|---|---|
| discovery | Lead Gen who confirms | Visitor | Admin-set times, PHT, every day, max 6 a day; a Lead Gen confirms (and owns the lead) or rejects |
| intro | VA | Client | During VA Match, before any VA works for the client: the client requests a free time; the VA confirms or rejects; one open intro call per client |
| client_va | VA | Client, plus guests either side adds | Only between an active client and a VA actively assigned to them: the client or the VA schedules; it is booked at once, with its Meet link |

- **No approval step once the VA works for the client:** for `client_va` meetings, whoever schedules creates the event and Meet link straight away (on the VA's Google calendar, which is why only employees connect Google). What is tracked is the meeting's status and history. The two calls before that relationship exists keep a confirm: a discovery call (the Lead Gen's confirm assigns the lead's owner) and an intro call (the VA hasn't agreed to work with the client yet).
- **Length is open-ended:** whoever schedules sets start and end. Validation only: ends after it starts, at most 8 hours, no overlap with the VA's other platform meetings. A client picks from the VA's working hours minus Google busy times; a VA can schedule any time.
- **Free times:** working hours minus Google `freeBusy` for the organizer. Only "busy" is read — the content of anyone's calendar never reaches the app.
- **Only employees connect Google** (their own Google account, personal Gmail allowed). Clients and visitors need no Google account: Google emails the invite and every update to their address.
- **Shown in the app:** only meetings created through the platform. Client, VA, Lead Gen and admin each see the meetings in their scope, with history and notes.
- **Notes:** each attendee can add a short note per meeting; it is a `meeting_events` row, shown in the history.
- **Meet limits:** on free Google accounts, a Meet with 3 or more participants ends at 60 minutes; one-to-one calls run up to 24 hours.

## Status flows

- **Lead:** new → (call confirmed, owner set) → contacted → qualified → won (client created) · closed.
- **Meeting:** scheduled → done | no_show | cancelled; rescheduling keeps it scheduled and logs old → new time. Discovery and intro calls start one step earlier: requested → scheduled (the Lead Gen or the VA confirms) | rejected. A `client_va` meeting starts at scheduled, and only while the client is active and the assignment is active. Either attendee on the platform records done or no-show; a past meeting with no outcome shows "needs outcome". One open discovery call per lead and one per date + time (with at most 6 times, that caps them at 6 a day); one open intro call per client; no two scheduled meetings overlap for the same organizer — all enforced by the database.
- **Client:** pending → active → inactive. **Registration:** ready → pending_customer → pending_review → approved | changes_requested → invite_sent.
- **Shortlist:** offered → accepted (creates the assignment) | declined.
- **Task:** todo → in_progress → done; overdue = not done after its deadline (computed, not stored).
- **Account:** invited → active → inactive.

## Discovery-call booking

- Times are PHT (`Asia/Manila`) times of day, every day; a meeting's start and end are stored in UTC. Pickers show PHT and the viewer's local time.
- The contact page stays static: the picker fetches open slots from `GET /api/v1/discovery-slots` (next 14 days — TODO: confirm the window), and the form posts the lead and slot together to `POST /api/v1/leads`. A slot taken in the meantime is a field error.

## Google sync

- **Schedule** (or a Lead Gen's confirm; Server Actions) creates the event as the organizer: Calendar API, `conferenceData` for Meet, attendees, `sendUpdates=all`. If Google fails, nothing changes and the user sees "try again".
- **Reschedule / cancel in the app** patch or delete the Google event; Google notifies the attendees.
- **Changes in Google** (cancelled, moved) arrive through a push channel at `POST /api/v1/google/calendar-events` (verified by the channel token) and are written to `meeting_events`; channels are renewed before they expire.
- **Disconnected or revoked Google:** no new meetings can be scheduled with that employee until they reconnect; the admin overview flags it.
- Google is called over REST with `fetch` — no SDK dependency. Scopes: `calendar.events`, `calendar.freebusy`.
- The OAuth app is **External** (employees use their own Google accounts), so production needs Google's verification for sensitive scopes: verified `islandsva.com`, the privacy policy, a demo video. While unverified, refresh tokens expire after 7 days — start verification in M9.

## Audit log

- Written by database triggers on leads, meetings, clients, assignments, shortlists, tasks and roles — so nothing that changes a row can skip it, whether it's the app, an admin or Google sync.
- Append-only: no update or delete grant for anyone, the secret key included in app code.
- Records changed field names and safe values (statuses, times, ids); free text and contact details stay out.
- The timelines (`lead_events`, `meeting_events`, `client_notes`) stay the readable story; the audit log is the who-did-what record behind them.

## Metrics

Computed from data, never typed in. On-time rate = tasks done by their deadline ÷ tasks done. Contracted revenue = active clients' `monthly_cents`. Lead Gen results = calls confirmed, done, no-show, won. Meetings = held, cancelled, no-show, per client and per VA.

## Access

Roles and `tenant_id` come from the token; pages call `requireRole`, RLS checks again; admins need TOTP.

| Role | Sees |
|---|---|
| Lead Gen | The shared inbox of requested discovery calls; leads, meetings and clients they own, with full history; audit entries for those records |
| Client | Their own tasks, shortlist, VAs, package, and meetings with their VAs |
| VA | Their own tasks; every meeting they attend (intro calls and client↔VA meetings) with its full history and notes; for intro calls, the prospective client's company name and the shortlist outcome; the clients they are assigned to |
| Admin | Everything in their tenant, including the full audit log; changes discovery-call times, shortlists, employees and registrations |

## Planned modules

A folder is created when its milestone starts, then moves into the `CLAUDE.md` §3 map.

| Milestone | Feature folder | Routes |
|---|---|---|
| M8 | `features/meetings` (discovery first) · `features/audit` | `api/v1/discovery-slots`; Lead Gen inbox, schedule, call history and activity under `closer/` |
| M9 | `features/google` | `api/v1/google/calendar-events`; Google connect / callback |
| M10 | `features/matching` (replaces `features/demos`) | client VA Match; VA working hours |
| M11 | `features/tasks` | client and VA task pages |
| M12 | `features/meetings` (client↔VA) | client and VA schedule pages |
| Later | — | `(workspace)/super-admin/`; `api/v1/health` before launch |

## Integrations

Supabase (database, auth) · Resend (email) · Cloudflare Turnstile · Google Calendar + Meet (OAuth per employee).

New env vars (M9): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (encrypts stored refresh tokens).

## Environments

Local, staging and production share one Supabase project until the staging project exists — test only with test data (`docs/operations.md`).
