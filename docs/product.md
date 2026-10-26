# Islands VA — Product

What the platform is for and who uses it. What ships when: `docs/mvp.md`. How it works: `docs/technical-spec.md`.

## Problem

VA agencies juggle enquiries, discovery calls, onboarding, payment proof, VA matching and day-to-day client work across email, calendars and spreadsheets.

## Product

One platform for an agency: a public site that books discovery calls, a Lead Gen tool that turns them into clients, VA matching, a shared workspace where clients and VAs plan tasks and meetings, and an admin view of the whole business. Every call is a Google Calendar event with a Meet link, with its history in the platform.

## Users

| Role | Does |
|---|---|
| Visitor | Reads the site, sends an enquiry, picks a discovery-call time |
| Lead Gen / Closer | Owns a lead from enquiry to Won: confirms the call, runs it, records the outcome, converts |
| Client | Chooses their VA, assigns tasks and deadlines, schedules meetings with their VAs, monitors their VAs, sees their package |
| VA | Works on their tasks, schedules meetings with their clients, sees their performance |
| Admin | Monitors everything (pipeline, won leads, clients, VAs, packages); manages staff, discovery-call times, VA shortlists |
| Super Admin | Everything an admin does, across agencies (tenants) |

## Journey

1. **Enquiry + booking:** the visitor fills in the contact form, then picks an open discovery-call time → a lead and a call request; the agency is emailed.
2. **Confirm:** any Lead Gen confirms the call — and becomes the lead's owner — or rejects it as junk. Confirming creates a Google Calendar event with a Meet link on that Lead Gen's calendar; Google emails the visitor the invite.
3. **Outcome:** cancellations made in Google sync back; the Lead Gen records Done or No-show.
4. **Won:** one click creates the client and emails the registration link (business and billing details, consent, payment proof). An admin approves it.
5. **VA Match:** the admin shortlists 1–3 VAs; the client accepts one, or books an intro call with one first. Accepting assigns the VA; "Send activation" follows.
6. **Work:** the client creates tasks with deadlines for their VAs; the VA updates status; both see progress.
7. **Meetings:** once the client is subscribed and has VAs working for them, the client or any of those VAs schedules a meeting — no approval step; it is booked at once and Google sends the invite with a Meet link. What matters is its status: scheduled, rescheduled, cancelled, done or no-show. Both see upcoming meetings, history and notes.

## Requirements by workspace

- **Public site:** contact form with a slot picker (open times only, shown in PHT and the visitor's local time); Turnstile, honeypot, rate limit.
- **Lead Gen:** shared inbox of call requests; their pipeline (leads they own); calendar synced with Google; outcomes; Won → client; their clients.
- **Client:** dashboard (VAs, package, next meetings); VA Match; tasks (create, assign to one of their VAs, deadline, comments, close); schedule (schedule, reschedule, cancel meetings with their VAs; record done or no-show; history and notes); VA overview (tasks done, on-time rate, overdue, meetings held).
- **VA:** task list across clients; status updates; working hours; schedule (schedule, reschedule, cancel meetings; record done or no-show; history and notes); Google connection; performance (tasks done, on-time rate, overdue).
- **Admin:** overview (calls booked / done / no-show / cancelled, leads won per Lead Gen, active clients, VAs and their load, meetings per client and VA, staff without a Google connection, package mix, contracted revenue); discovery-call times; leads (read-only pipeline), clients, Teams, registration review, VA shortlists, every meeting's history.
- **Super Admin:** the admin view across tenants, plus tenant management.

## Operating rules

- **One pipeline, one owner:** the Lead Gen who confirms a call owns that lead to Won; admins watch the pipeline, they don't work it.
- **No back-and-forth:** the visitor books while filling in the form; the Lead Gen only confirms or rejects.
- **Google is the meeting, for every call:** discovery, intro and client↔VA meetings are events on the organizer's Google calendar with a Meet link; the invite comes from Google and changes sync back. Between a subscribed client and their VAs, anyone in the meeting can schedule it; the status is what's tracked. Before that relationship exists, a call needs a confirm: a discovery call by a Lead Gen (it sets the lead's owner), an intro call by the VA.
- **Only staff connect Google** (their own account; personal Gmail is fine). Clients and visitors just get the invite by email.
- **Every meeting has a history:** who scheduled, confirmed, moved or cancelled it, when, and the attendees' notes.
- **Won is one click:** it creates the client and sends the registration link.
- **The client picks their VA** from an admin shortlist, with an optional intro call.

## Principles

Invite-only accounts, deactivated, never deleted. Each role sees only its own data. No PII in URLs, logs or titles. Fast static public pages.

## To follow (after the MVP)

Call reminder emails (24 h and 1 h before) · VA time tracking and hours vs package (upsell and retention flags) · payment automation (Stripe) · client rating of VAs · blog · chatbot.

## Out of scope

VA mailer, salary deductions, payroll, native apps, i18n, screen or activity monitoring of VAs.
