import "server-only";
import { packages } from "@/content/packages";
import { appRoutes } from "@/content/routes";
import { site } from "@/content/site";
import { callTimeLines } from "@/content/timezones";
import { sendPlainEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { LeadInput } from "./validation";

/**
 * Notifies the team of a new enquiry. Returns false (and logs) when email isn't configured or doesn't go out.
 * A discovery request gets fixed text and the time only: its contact details stay in the Lead Gens' inbox, which hides
 * the email address until a Lead Gen confirms, so the team mailbox mustn't carry them. A plain enquiry (no time open)
 * has no inbox entry, so its email carries the details and replies go to the visitor.
 */
export async function sendLeadNotification(lead: LeadInput, startsAt?: string) {
  const to = env.leadsNotifyEmail();
  if (!to) {
    console.warn("Lead email skipped: LEADS_NOTIFY_EMAIL is not set");
    return false;
  }
  if (startsAt) {
    const [first, ...rest] = callTimeLines(lead.country, startsAt);
    return sendPlainEmail("Lead email", {
      to,
      subject: `New discovery request for ${first}`,
      text: [`New discovery request for ${first}.`, ...rest.map((line) => `That is ${line}.`), "", `Open the inbox: ${site.url}${appRoutes.leadgen}`].join("\n"),
    });
  }
  const packageName = packages.find((p) => p.slug === lead.packageSlug)?.name ?? "Not sure yet";
  return sendPlainEmail("Lead email", {
    to,
    replyTo: lead.email,
    subject: `New enquiry from ${lead.name}`,
    text: [
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Company: ${lead.company}`,
      `Industry: ${lead.industry}`,
      `Country: ${lead.country}`,
      `Package: ${packageName}`,
      "",
      lead.message,
    ].join("\n"),
  });
}
