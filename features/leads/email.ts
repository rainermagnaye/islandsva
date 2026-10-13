import "server-only";
import { packages } from "@/content/packages";
import { env } from "@/lib/env";
import type { LeadInput } from "./validation";

/**
 * Notifies the team of a new enquiry via Resend's REST API. Plain text only, so user input is never
 * interpreted as HTML. Returns false (and logs) when email isn't configured.
 */
export async function sendLeadNotification(lead: LeadInput) {
  const apiKey = env.resendApiKey();
  const to = env.leadsNotifyEmail();
  const from = env.emailFrom();
  if (!apiKey || !to || !from) {
    console.warn("Lead email skipped: RESEND_API_KEY, LEADS_NOTIFY_EMAIL or EMAIL_FROM is not set");
    return false;
  }

  const packageName = packages.find((p) => p.slug === lead.packageSlug)?.name ?? "Not sure yet";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: lead.email,
      subject: `New enquiry from ${lead.name}`,
      text: [
        `Name: ${lead.name}`,
        `Email: ${lead.email}`,
        `Company: ${lead.company ?? "—"}`,
        `Package: ${packageName}`,
        "",
        lead.message,
      ].join("\n"),
    }),
  });
  if (!res.ok) {
    console.error("Resend error", { status: res.status, body: await res.text().catch(() => "") });
    return false;
  }
  return true;
}
