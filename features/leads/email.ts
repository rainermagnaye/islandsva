import "server-only";
import { packages } from "@/content/packages";
import { callTimeLines } from "@/content/timezones";
import { sendPlainEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { LeadInput } from "./validation";

function discoveryLines(country: string, startsAt?: string) {
  if (!startsAt) return [];
  const [first, ...rest] = callTimeLines(country, startsAt);
  return [`Discovery call: ${first}`, ...rest];
}

/** Notifies the team of a new enquiry. Returns false (and logs) when email isn't configured or doesn't go out. */
export async function sendLeadNotification(lead: LeadInput, startsAt?: string) {
  const to = env.leadsNotifyEmail();
  if (!to) {
    console.warn("Lead email skipped: LEADS_NOTIFY_EMAIL is not set");
    return false;
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
      ...discoveryLines(lead.country, startsAt),
      "",
      lead.message,
    ].join("\n"),
  });
}
