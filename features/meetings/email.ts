import "server-only";
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
