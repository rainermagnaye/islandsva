import "server-only";
import { routes } from "@/content/routes";
import { site } from "@/content/site";
import { callTimeLines } from "@/content/timezones";
import { sendPlainEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * The visitor's "your call is confirmed" email. Fixed text plus the time (nothing the visitor typed), Reply-To the
 * team inbox. The key names the meeting and its start, so a retry after a timeout can't send the same email twice,
 * while a rescheduled call still gets its new time. Returns false (logged by sendPlainEmail) when it doesn't go out.
 */
export function sendDiscoveryConfirmation(call: { meetingId: string; email: string; startsAt: string; country: string | null }) {
  const [when, ...also] = callTimeLines(call.country, call.startsAt);
  return sendPlainEmail(
    "Discovery confirmation email",
    {
      to: call.email,
      replyTo: env.leadsNotifyEmail() || undefined,
      subject: "Your discovery call with Islands VA is confirmed",
      text: [
        "Hello,",
        "",
        `Your discovery call with Islands VA is confirmed for ${when}.`,
        ...also.map((line) => `That is ${line}.`),
        "",
        "We'll send the call link before the call. Reply to this email if you need to change the time.",
        "",
        "See you then,",
        "Islands VA",
      ].join("\n"),
    },
    `discovery-confirmation/${call.meetingId}/${call.startsAt}`,
  );
}

const IGNORE_IF_NOT_YOU = "If you didn't make this request, ignore this email. We won't contact you unless a call is confirmed.";

/**
 * The visitor's "we've received your request" email, right after the contact form. Fixed text plus the time the server
 * formats from the stored start — nothing the visitor typed (no name, company or message), so the form can't be used to
 * send our mail with someone else's words. One per request (key per meeting).
 */
export function sendDiscoveryAcknowledgement(call: { meetingId: string; email: string; startsAt: string; country: string | null }) {
  const [when, ...also] = callTimeLines(call.country, call.startsAt);
  return sendPlainEmail(
    "Discovery acknowledgement email",
    {
      to: call.email,
      replyTo: env.leadsNotifyEmail() || undefined,
      subject: "We've received your discovery call request",
      text: [
        "Hello,",
        "",
        `We've received your request for a discovery call with Islands VA on ${when}.`,
        ...also.map((line) => `That is ${line}.`),
        "",
        "We'll confirm it shortly by email.",
        "",
        IGNORE_IF_NOT_YOU,
        "",
        "Islands VA",
      ].join("\n"),
    },
    `discovery-acknowledgement/${call.meetingId}`,
  );
}

/** The visitor's "we couldn't confirm that time" email, once nobody confirmed the request in time. One per request. */
export function sendDiscoveryExpired(call: { meetingId: string; email: string; startsAt: string; country: string | null }) {
  const [when] = callTimeLines(call.country, call.startsAt);
  return sendPlainEmail(
    "Discovery expiry email",
    {
      to: call.email,
      replyTo: env.leadsNotifyEmail() || undefined,
      subject: "Please pick another time for your discovery call",
      text: [
        "Hello,",
        "",
        `We're sorry, we couldn't confirm your discovery call for ${when}.`,
        "",
        `Please pick another time here: ${site.url}${routes.contact}`,
        "",
        IGNORE_IF_NOT_YOU,
        "",
        "Islands VA",
      ].join("\n"),
    },
    `discovery-expiry/${call.meetingId}`,
  );
}
