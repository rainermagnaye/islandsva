# Islands VA — Technical spec

The domain model, status flows and integrations. Stack, layers, folder map and coding rules: `CLAUDE.md`. Database rules: `supabase/CLAUDE.md`. Why each choice: `docs/decisions.md`.

## Data model

| Table | Holds | Status |
|---|---|---|
| tenants · profiles · roles | Agencies; accounts; roles per user | Built |
| employee_profiles | VA and Lead Gen details, résumé, avatar, references | Built |
| leads · lead_events | Enquiries and timeline; `closer_id` = the owning Lead Gen, set when they confirm the discovery call | Built; Lead Gens work their own leads (M8) |
| discovery_times | Admin-set daily times of day (PHT), at most 6 | Built (M8; rules in `supabase/CLAUDE.md`) |
| meetings | Every call: kind, organizer, decided by, start, end, status, Google event id, Meet link. `manual` is an admin booking (title, optional client and staff) with no Google event yet | Built for discovery calls (M8) and admin bookings; attendees and Google (M9); intro and client↔VA kinds (M10, M12) |
| meeting_events | Meeting history: requested, scheduled, rejected, done, no-show, note, expired | Built (M8); rescheduled (old → new) and cancelled (by whom, app or Google) with M9 |
| google_connections | An employee's encrypted refresh token, calendar id, push channel | New (M9) |
| va_working_hours | A VA's weekly hours (PHT), one half-hour window per weekday. Read when intro calls exist | Built (M10); unused until meetings and Google |
| clients · client_packets · client_notes | Company and package; registration; notes | Built |
| client_agreements | Agreement acceptance evidence: version, text shown, terms snapshot (from the client row), typed name, contact email on file, hashed IP, time. Append-only, server-only | Built: schema (slice 1a) and the registration link's agreement step (slice 2b); admin evidence view in slice 3 |
| va_shortlists | Client ↔ shortlisted VA, status (offered, accepted, declined). Accept creates the assignment | Built (M10) |
| client_va_assignments | Client ↔ VA, several active VAs, one active row per pair | Built |
| tasks · task_comments | Client, VA, title, deadline, status, comments | Built; audited (ids, status, dates — never the title or comments) |
| audit_log | Append-only who-did-what: actor (user or system; Google sync in M9), action, record type + id, owning Lead Gen / client, changed fields (values only for safe columns), at | Built (M8; rules in `supabase/CLAUDE.md`) |
| demo_slots · demo_bookings | Client ↔ VA demo calls | Built; replaced by `meetings` (intro calls), drop in M10 |
| client_onboarding_links · payments | Replaced by the registration packet | Drop |

## Registration link (three steps)

- Built (slice 2b): `/register/[token]` shows a stepper (Details · Agreement · Payment proof) and only the first open step, chosen on the server by `openRegistrationSteps` (the same rule as `private.packet_open_sections`). Each step saves on its own through `features/clients/registration-actions.ts`; the token is the access check. After a return, a note names the steps sent back (old section names map to their step). Once nothing is open the database moves the packet to review, and the link shows the read-only receipt.
- The agreement text is rendered on the server (`currentAgreement`), with its version and fingerprint in hidden fields; the box is never pre-ticked. The wording is a sample until legal review (`content/agreement.ts`, `TODO(legal)`).

## Registration payment verification

- Built (slice 3): an admin approves through `approve_client_payment` (`approveClientPayment` in `onboarding-dal.ts`), with the signed-in admin as the actor. "Approve and send invite" approves the packet and records the payment in one transaction, then sends the password invite; if the invite fails the client stays approved, and the profile shows a warning and Send activation. Refusals: `IVA41` and `IVA42` on the reference field, `IVA43` as "The client must accept the current agreement before you approve".
- The reference is required and normalised before the call (`normaliseReference`: NFKC, Unicode format and control characters removed, trimmed), so look-alike or invisible characters can't slip a duplicate past the database's comparison (whitespace removed, case ignored).
- The review shows the agreement evidence, admins only (`agreementReviewFor` checks `requireRole(["admin"])` before any read): version, time, signer, contact email on file, whether an IP was recorded, and the full text; or "Signed with the earlier consent form". A stale or missing acceptance shows a warning and disables Approve. Six required checkboxes (proof, identifiable, amount, funds received, not credited elsewhere, reference) gate the form in the browser; nothing about them is stored.
- Sending back offers the three steps (Details, Agreement, Payment proof), stored as `basic`, `consent` and `payment` (`REVIEW_SECTION_FOR_STEP`), because the live `save_client_review` accepts only the original names; every admin screen labels stored sections by step. The contract migration may store Agreement as `agreement` instead.
- Agreement rules are built (slice 2a): `content/agreement.ts`, `features/clients/agreement.ts`, `registration-dal.ts`, `registration-validation.ts`, `acceptAgreement` / `agreementReviewFor` in `service.ts`. A stale page is reason `changed` from both the service and the database's `IVA43`; map it to `AGREEMENT_CHANGED`.
- The Privacy Policy covers the acceptance record (slice 2b): what is kept, why, retention (`TODO(legal)` for the period) and that erasure is refused while it's needed for a contract or legal claim.
- After the review, the link shows no client data: the read-only receipt only while the packet is in review; once approved, invited or active, "Registration complete" and a sign-in link (`registrationView`).
- Slices 2b and 3 deploy together: 2b alone would leave admins approving through `accept_client_review_paid`, which doesn't check the agreement.
- **Slice 4 (planned):** the payments queue and the send-back email.

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

- **Lead:** request (stored as an unowned `new` lead with an open discovery request; shown only in the Lead Gens' inbox, not in leads lists or pipeline counts) → new (call confirmed, owner set) → contacted → qualified → won (client created) · closed (a rejected request closes as junk and never shows as a lead).
- **Meeting:** scheduled → done | no_show | cancelled; rescheduling keeps it scheduled and logs old → new time. Discovery and intro calls start one step earlier: requested → scheduled (the Lead Gen or the VA confirms) | rejected | expired (nobody answered before its time). A `client_va` meeting starts at scheduled, and only while the client is active and the assignment is active. Either attendee on the platform records done or no-show; a past meeting with no outcome shows "needs outcome". Discovery calls are built (`supabase/CLAUDE.md` → `meetings`); still to come: one open intro call per client; no two scheduled meetings overlap for the same organizer — all enforced by the database.
- **Client:** pending → active → inactive. **Registration:** ready → pending_customer → pending_review → approved | changes_requested → invite_sent.
- **Shortlist:** offered → accepted (creates the assignment) | declined.
- **Task:** todo → in_progress → done; overdue = not done after its deadline (computed, not stored).
- **Account:** invited → active → inactive.

## Discovery-call booking

- The database side is built: times, slots (12 hours to 14 days ahead), requests, confirm / reject, outcomes and the Lead Gens' inbox — `supabase/CLAUDE.md`. Pickers show PHT and the viewer's local time.
- The contact page stays static: the picker fetches open slots from `GET /api/v1/discovery-slots` (secret key, `open_discovery_slots`), and the form posts the lead and slot together to `POST /api/v1/leads` (`request_discovery_call`). A slot taken in the meantime (`IVA22`, or `23505` from a request at the same moment) is a field error; `IVA24` gets a generic message.
- Planned with the lead handover (M8 slice 6): column-level select grants on `leads`, so an owning Lead Gen can't read `ip_hash` and `user_agent`.
- **Request vs lead:** no separate table. A submitted request is the lead row plus its `requested` meeting; leads lists, pipeline counts, search and the sales summary leave out unowned leads that came from a discovery request and were never confirmed (no meeting of theirs ever reached `scheduled`) — open, expired and rejected requests alike — through one shared filter (a dal helper or a `security_invoker` view; slices 4 and 7). The visitor counts as a lead once a Lead Gen confirms. Admins see requests under a Requests filter, searchable by email (for "I booked and heard nothing" and abuse); Lead Gens only through the inbox.

### Visitor emails (slices 4 and 5)

Plain text through `sendPlainEmail`, sent in `after()`, Reply-To the team inbox. Logs carry the meeting id and `service`, never the address or name.

| When | Email | Content |
|---|---|---|
| Request stored (`POST /api/v1/leads`) | Acknowledgement | Fixed text plus the requested time, formatted by the server from the stored start (PHT and the visitor's zone): received, we'll confirm shortly by email; "If you didn't make this request, ignore this email — we won't contact you unless a call is confirmed." Nothing the visitor typed — no name, company or message — so the form can't be used to send our mail with someone else's words. |
| Request stored | Agency notification | Fixed text: "New discovery request for [time] — open the inbox." No contact details, so the team mailbox doesn't undo the inbox hiding them. |
| A Lead Gen confirms | Confirmation | Fixed text plus the time: confirmed, see you then. Until M9 the Lead Gen sends the call link themselves; from M9 Google's invite (Meet link) replaces this email. |
| A request expires unconfirmed | Expired | Fixed text: we couldn't confirm that time, please pick another, with the contact page link. |
| Rejected | None | — |

**Limits.** Sent only after the honeypot and Turnstile pass and the slot is reserved. At most 1 acknowledgement per address per 24 hours and 3 per 30 days (counted from `ack_sent_at` joined to `leads.email`), and at most 40 automatic visitor emails per agency per day (below Resend's free-tier 100; revisit on Resend Pro). Past a limit the request is still stored and the visitor sees the same success, but no email is sent. An expiry email goes only where an acknowledgement went. The address must contain none of `, ; < > " ( ) [ ] \` (a stricter `deliverableEmailField`, tested). The visitor's time zone is used only if it is a valid IANA zone (`Intl.supportedValuesOf('timeZone')`, otherwise PHT only) and is stored on the meeting (`visitor_timezone`, length and pattern checked). Each email is sent at most once: `meetings.ack_sent_at`, `confirmation_sent_at` and `expiry_notice_sent_at`, server-only and in `private.audit_ignore('meetings')`; the row is claimed (timestamp set) in the statement that selects it, then sent. A failed courtesy email is logged, not retried; a failed confirmation clears `confirmation_sent_at` so the Lead Gen can resend from the inbox. The Vercel Firewall rate limit on `POST /api/v1/leads` is live before this ships. If abuse continues, the fallback is double opt-in: a single-use "confirm your request" link (token stored as SHA-256) holding the slot for 30 minutes.

**Expiry.** A request can be confirmed until 2 hours before its start; after that it is expired (`decide_discovery_call` → `IVA23`, `discovery_inbox()` and the lazy settling use the same cutoff — a new `db/` migration). Supabase `pg_cron` runs `private.expire_discovery_requests()` every 15 minutes (requested → `expired` plus an `expired` event, actor System), then `pg_net` calls production's `POST /api/v1/internal/discovery-expiry` with a bearer secret kept in Supabase Vault and a Vercel env var (`lib/env.ts`). That Route Handler isn't `createHandler` (no Origin): it compares the secret in constant time, otherwise answers `404`, takes no body, calls `claim_expiry_notices` (service_role only; claims up to 50 expired requests with an acknowledgement and no notice yet, returning meeting id, email and start) and sends in `after()`. Staging never sends them, because it shares the database. Rejected: Vercel Hobby cron (once a day), a Supabase Edge Function (second runtime and home for the Resend key), Resend straight from `pg_net` (Resend key in the database).

## Google sync

- **Schedule** (or a Lead Gen's confirm; Server Actions) creates the event as the organizer: Calendar API, `conferenceData` for Meet, attendees, `sendUpdates=all`. If Google fails, nothing changes and the user sees "try again".
- **Reschedule / cancel in the app** patch or delete the Google event; Google notifies the attendees.
- **Changes in Google** (cancelled, moved) arrive through a push channel at `POST /api/v1/google/calendar-events` (verified by the channel token) and are written to `meeting_events`; channels are renewed before they expire.
- **Disconnected or revoked Google:** no new meetings can be scheduled with that employee until they reconnect; the admin overview flags it.
- Google is called over REST with `fetch` — no SDK dependency. Scopes: `calendar.events`, `calendar.freebusy`.
- The OAuth app is **External** (employees use their own Google accounts), so production needs Google's verification for sensitive scopes: verified `islandsva.com`, the privacy policy, a demo video. While unverified, refresh tokens expire after 7 days — start verification in M9.

## Audit log

- Built for leads, meetings, clients, assignments, tasks, shortlists, roles and account status: `supabase/CLAUDE.md` (access model and the actor rule). Google sync (M9) adds a `google` actor kind.
- Readers: admins with 2FA, and the owning Lead Gen for leads, calls, clients and assignments (task and shortlist entries are admins only). Whether clients and VAs see entries for their own records is decided with the activity screens (M8 slice 9).
- **Not audited for now:** payments (recorded by an admin through `accept_client_review_paid`, with `recorded_by` on the row), discovery times, VA working hours, and the timelines (`lead_events`, `meeting_events`, `client_notes`, `task_comments`, `client_agreements`), which stay the readable story behind the audit log.
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
| M8 | `features/meetings` (started: discovery times in `/admin/settings`; now in the §3 map) · `features/audit` | `api/v1/discovery-slots`; Lead Gen inbox, schedule, call history and activity under `closer/` |
| M9 | `features/google` | `api/v1/google/calendar-events`; Google connect / callback |
| M10 | `features/matching` (replaces `features/demos`) | client VA Match; VA working hours |
| M11 | `features/tasks` | client and VA task pages |
| M12 | `features/meetings` (client↔VA) | client and VA schedule pages |
| Later | — | `(workspace)/super-admin/`; `api/v1/health` before launch |

## Integrations

Supabase (database, auth) · Resend (email) · Cloudflare Turnstile · Google Calendar + Meet (OAuth per employee).

New env vars (M9): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (encrypts stored refresh tokens).
