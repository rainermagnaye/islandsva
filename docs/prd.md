# Islands VA — Product requirements (PRD)

What the platform is for and who uses it. What ships when: `docs/mvp.md`. How it works: `docs/technical-spec.md`.

## Problem

VA agencies juggle enquiries, discovery calls, onboarding, payment proof, VA matching and day-to-day client work across email, calendars and spreadsheets.

## Product

One platform for an agency: a public site that books discovery calls, a Lead Gen tool that turns them into clients, VA matching, a shared workspace where clients and VAs plan tasks and meetings, and an admin view of the whole business. Every call is a Google Calendar event with a Meet link, with its history in the platform.

## Users

| Role | Does |
|---|---|
| Visitor | Reads the site, sends an enquiry, picks a discovery-call time |
| Lead Gen / Closer | Owns a lead from enquiry to Won: confirms the call, runs it, records the outcome, converts; monitors their calls, schedule, history and activity log |
| Client | Chooses their VA, assigns tasks and deadlines, schedules meetings with their VAs, monitors their VAs and the hours they work, validates those hours each month, sees their package and its remaining hours |
| VA | Confirms and tracks their intro calls with prospective clients, works on their tasks, logs their working time per client, schedules meetings with their clients, sees their performance and hours |
| Admin | Monitors everything (pipeline, won leads, clients, VAs, packages, hours); manages employees (invites, profiles, roles, deactivation of VAs, Lead Gens and admins), discovery-call times, VA shortlists; corrects logged time and resolves disputed days |
| Super Admin | Everything an admin does, across agencies (tenants) |

## Journey

1. **Enquiry + booking:** the visitor fills in the contact form and picks an open discovery-call time → a call request; the agency is emailed, and the visitor gets an acknowledgement ("we've received your request for [time]; we'll confirm it shortly by email"). Until a Lead Gen confirms, it is a request, not a lead.
2. **Confirm:** any Lead Gen confirms the call — the request becomes their lead — or rejects it as junk. On confirm the visitor is emailed that the call is confirmed ("see you then"); from M9 that is Google's calendar invite with the Meet link, created on the Lead Gen's calendar. A rejected request is never a lead and gets no email. A request nobody confirms by 2 hours before its time expires, and the visitor is emailed to pick another time.
3. **Outcome:** cancellations made in Google sync back; the Lead Gen records Done or No-show.
4. **Won:** one click creates the client and emails the registration link (business and billing details, consent, payment proof). An admin approves it.
5. **VA Match:** the admin shortlists 1–3 VAs; the client accepts one, or requests an intro call with one first (the VA confirms). Accepting assigns the VA; "Send activation" follows.
6. **Work:** the client creates tasks with deadlines for their VAs; the VA updates status; both see progress.
7. **Meetings:** once the client is subscribed and has VAs working for them, the client or any of those VAs schedules a meeting — no approval step; it is booked at once and Google sends the invite with a Meet link. What matters is its status: scheduled, rescheduled, cancelled, done or no-show. Both see upcoming meetings, history and notes.
8. **Hours:** the VA presses play on the client they're working for and pause when they stop; the time counts live. A day is complete once the VA reaches that client's daily target (package hours per week ÷ 5, e.g. 8 h on 40 h a week); the client's remaining balance goes down as the hours are logged. After the month ends, the client approves or disputes each day.

## Requirements by workspace

- **Public site:** contact form with a slot picker (open times only, shown in PHT and the visitor's local time); Turnstile, honeypot, rate limit.
- **Lead Gen:** shared inbox of call requests; their pipeline (leads they own); schedule (upcoming discovery calls, synced with Google); outcomes; call history (every call they confirmed, rejected or ran — done, no-show, cancelled, rescheduled — with notes); Won → client; their clients; activity log (every change to their leads, calls and clients — by them, an admin or Google — with who and when); their results (calls confirmed, done, no-show, won).
- **Client:** dashboard (VAs, package, next meetings); VA Match; tasks (create, assign to one of their VAs, deadline, comments, close); schedule (schedule, reschedule, cancel meetings with their VAs; record done or no-show; history and notes); VA overview (tasks done, on-time rate, overdue, meetings held); hours (each VA's hours today, this week and this month, the package hours left this week and this month, the session history, and the month-end review: approve or dispute each day with a note).
- **VA:** intro calls (requests to confirm or reject; upcoming; history of every intro call — confirmed, rejected, done, no-show, cancelled — with notes and whether the client then chose them); task list across clients (deadline and status; no task timer); status updates; timer (play / pause per client; switching to another client asks first, then pauses the running one; a live counter, today's first start and last stop, progress to each client's daily target and the day's total goal; hours per day, week and month; balance left per client; full history with each day's validation status); working hours; schedule (schedule, reschedule, cancel meetings; record done or no-show; history and notes); Google connection; performance (tasks done, on-time rate, overdue).
- **Admin:** overview (calls booked / done / no-show / cancelled, leads won per Lead Gen, active clients, VAs and their load, meetings per client and VA, employees without a Google connection, package mix, contracted revenue); discovery-call times; leads (read-only pipeline), clients, employees (Teams), registration review, VA shortlists, every meeting's history; hours per VA and client, disputed days to resolve, sessions left running at midnight to correct; the tenant's full activity log.
- **Super Admin:** the admin view across tenants, plus tenant management.

## Operating rules

- **One pipeline, one owner:** the Lead Gen who confirms a call owns that lead to Won; admins watch the pipeline, they don't work it.
- **No back-and-forth:** the visitor books while filling in the form; the Lead Gen only confirms or rejects.
- **Google is the meeting, for every call:** discovery, intro and client↔VA meetings are events on the organizer's Google calendar with a Meet link; the invite comes from Google and changes sync back. Between a subscribed client and their VAs, anyone in the meeting can schedule it; the status is what's tracked. Before that relationship exists, a call needs a confirm: a discovery call by a Lead Gen (it sets the lead's owner), an intro call by the VA.
- **Only employees connect Google** (VAs and Lead Gens) — their own account; personal Gmail is fine. Clients and visitors just get the invite by email.
- **Every meeting has a history:** who scheduled, confirmed, moved or cancelled it, when, and the attendees' notes.
- **Every change is logged:** an activity log records who changed which lead, call, client, assignment or task, and when. No one can edit or delete it. Each person sees the entries for their own records; admins see all.
- **Won is one click:** it creates the client and sends the registration link.
- **The client picks their VA** from an admin shortlist, with an optional intro call.
- **Hours are what the timer logged:** the VA starts and pauses it, the database clock records it, and only an admin corrects it. A day counts up to its target, never more (8 h 15 min on an 8 h target uses 8 h); a short day uses what was worked. The client validates every day after the month ends; days left undecided for 5 days are approved.

## Principles

Invite-only accounts, deactivated, never deleted. Each role sees only its own data. No PII in URLs, logs or titles. Fast static public pages.

## To follow (after the MVP)

Call reminder emails (24 h and 1 h before) · upsell and retention flags from hours used · payment automation (Stripe) · client rating of VAs · blog · chatbot.

## Out of scope

VA mailer, salary deductions, payroll, native apps, i18n, screen or activity monitoring of VAs.
