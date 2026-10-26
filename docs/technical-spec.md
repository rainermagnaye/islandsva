# Islands VA — Technical spec

The domain model, status flows and integrations. Stack, layers, folder map and coding rules: `CLAUDE.md`. Database rules: `supabase/CLAUDE.md`. Why each choice: `docs/decisions.md`.

## Data model

| Table | Holds | Status |
|---|---|---|
| tenants · profiles · roles | Agencies; accounts; roles per user | Built |
| employee_profiles | VA and Lead Gen details, résumé, avatar, references | Built |
| leads · lead_events | Enquiries and timeline; `closer_id` = the owning Lead Gen, set when they confirm the discovery call | Built; Lead Gens work their own leads (M8) |
| discovery_times | Admin-set daily times of day (PHT), at most 6 | Built (M8; rules in `supabase/CLAUDE.md`) |
| meetings | Every call: kind, organizer, decided by, start, end, status, Google event id, Meet link | Built for discovery calls (M8); attendees and Google (M9); intro and client↔VA kinds (M10, M12) |
| meeting_events | Meeting history: requested, scheduled, rejected, done, no-show, note, expired | Built (M8); rescheduled (old → new) and cancelled (by whom, app or Google) with M9 |
| google_connections | An employee's encrypted refresh token, calendar id, push channel | New (M9) |
| va_working_hours | A VA's weekly hours (PHT), one half-hour window per weekday. Read when intro calls exist | Built (M10); unused until meetings and Google |
| clients · client_packets · client_notes | Company and package; registration; notes | Built |
| va_shortlists | Client ↔ shortlisted VA, status (offered, accepted, declined). Accept creates the assignment | Built (M10) |
| client_va_assignments | Client ↔ VA, several active VAs, one active row per pair | Built |
| tasks · task_comments | Client, VA, title, deadline, status, comments | In the migration (built in the app; the audit trigger still waits on audit_log) |
| audit_log | Append-only who-did-what: actor (user or system; Google sync in M9), action, record type + id, owning Lead Gen / client, changed fields (values only for safe columns), at | Built (M8; rules in `supabase/CLAUDE.md`); shortlists and tasks join when they're built |
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
- **Meeting:** scheduled → done | no_show | cancelled; rescheduling keeps it scheduled and logs old → new time. Discovery and intro calls start one step earlier: requested → scheduled (the Lead Gen or the VA confirms) | rejected | expired (nobody answered before its time). A `client_va` meeting starts at scheduled, and only while the client is active and the assignment is active. Either attendee on the platform records done or no-show; a past meeting with no outcome shows "needs outcome". Discovery calls are built (`supabase/CLAUDE.md` → `meetings`); still to come: one open intro call per client; no two scheduled meetings overlap for the same organizer — all enforced by the database.
- **Client:** pending → active → inactive. **Registration:** ready → pending_customer → pending_review → approved | changes_requested → invite_sent.
- **Shortlist:** offered → accepted (creates the assignment) | declined.
- **Task:** todo → in_progress → done; overdue = not done after its deadline (computed, not stored).
- **Account:** invited → active → inactive.

## Discovery-call booking

- The database side is built: times, slots (12 hours to 14 days ahead), requests, confirm / reject, outcomes and the Lead Gens' inbox — `supabase/CLAUDE.md`. Pickers show PHT and the viewer's local time.
- The contact page stays static: the picker fetches open slots from `GET /api/v1/discovery-slots` (secret key, `open_discovery_slots`), and the form posts the lead and slot together to `POST /api/v1/leads` (`request_discovery_call`). A slot taken in the meantime (`IVA22`, or `23505` from a request at the same moment) is a field error; `IVA24` gets a generic message.
- Planned with the lead handover (M8 slice 6): column-level select grants on `leads`, so an owning Lead Gen can't read `ip_hash` and `user_agent`.

## Google sync

- **Schedule** (or a Lead Gen's confirm; Server Actions) creates the event as the organizer: Calendar API, `conferenceData` for Meet, attendees, `sendUpdates=all`. If Google fails, nothing changes and the user sees "try again".
- **Reschedule / cancel in the app** patch or delete the Google event; Google notifies the attendees.
- **Changes in Google** (cancelled, moved) arrive through a push channel at `POST /api/v1/google/calendar-events` (verified by the channel token) and are written to `meeting_events`; channels are renewed before they expire.
- **Disconnected or revoked Google:** no new meetings can be scheduled with that employee until they reconnect; the admin overview flags it.
- Google is called over REST with `fetch` — no SDK dependency. Scopes: `calendar.events`, `calendar.freebusy`.
- The OAuth app is **External** (employees use their own Google accounts), so production needs Google's verification for sensitive scopes: verified `islandsva.com`, the privacy policy, a demo video. While unverified, refresh tokens expire after 7 days — start verification in M9.

## Audit log

- Built for leads, meetings, clients, assignments, roles and account status: `supabase/CLAUDE.md` (access model and the actor rule). Shortlists (M10) and tasks (M11) are added as audited tables when they're built; Google sync (M9) adds a `google` actor kind.
- **Not audited for now:** payments (recorded by an admin through `accept_client_review_paid`, with `recorded_by` on the row), discovery times, and the timelines (`lead_events`, `meeting_events`, `client_notes`), which stay the readable story behind the audit log.
- Before launch (follow-up `db/audit-actors`): the remaining secret-key writes that show as System today — the registration-packet functions (`save_client_review`, `record_client_invite`, `issue_client_onboarding_link`), `accept_client_review_paid`, the admin's "add lead", and removing an employee account (`removeEmployeeAccount` → `deleteAuthUser`: its roles cascade is logged as System and the profile deletion isn't logged) — take an actor and set `app.actor`. The app's deactivation moves to `set_account_status` in its own PR once `audit_log` is live.

## Metrics

Computed from data, never typed in. On-time rate = tasks done by their deadline ÷ tasks done. Contracted revenue = active clients' `monthly_cents`. Lead Gen results = calls confirmed, done, no-show, won. Meetings = held, cancelled, no-show, per client and per VA.

## Access

Roles and `tenant_id` come from the token; pages call `requireRole`, RLS checks again; admins need TOTP.

| Role | Sees |
|---|---|
| Lead Gen | The shared inbox of requested discovery calls (no email until they confirm); leads, meetings and clients they own, with full history; audit entries for those records |
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
