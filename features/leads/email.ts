import "server-only";
import { packages } from "@/content/packages";
import { timezoneForCountry } from "@/content/timezones";
import { sendPlainEmail } from "@/lib/email";
import { env } from "@/lib/env";
import type { LeadInput } from "./validation";

function discoveryLines(country: string, startsAt?: string) {
  if (!startsAt) return [];
  const pht = `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(startsAt))} PHT`;
  const zone = timezoneForCountry(country);
  if (!zone || zone.value === "Asia/Manila") return [`Discovery call: ${pht}`];
  const local = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: zone.value }).format(new Date(startsAt));
  return [`Discovery call: ${local} ${zone.label.split(" — ")[1]}`, pht];
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
