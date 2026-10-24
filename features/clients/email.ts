import "server-only";
import { site } from "@/content/site";
import { env } from "@/lib/env";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/**
 * The onboarding form link, to the client's contact email, via Resend's REST API (no Supabase mailer, so it
 * works before custom SMTP). Plain text, so names are never interpreted as HTML. Returns false (and logs
 * without the address or link) when email isn't configured, unreachable or refused; the Closer can still copy the link.
 */
export async function sendOnboardingEmail(message: { to: string; contactName: string; companyName: string; link: string; expiresAt: string }) {
  const apiKey = env.resendApiKey();
  const from = env.emailFrom();
  if (!apiKey || !from) {
    console.warn("Onboarding email skipped: RESEND_API_KEY or EMAIL_FROM is not set");
    return false;
  }

  const text = [
    `Hi ${message.contactName},`,
    "",
    `Thanks for choosing ${site.name}. To set up ${message.companyName}, please fill in your onboarding form:`,
    "",
    message.link,
    "",
    `It takes a few minutes. The link works once and expires on ${day.format(new Date(message.expiresAt))}.`,
    `If it has expired, reply to your contact at ${site.name} and we'll send a new one.`,
    "",
    `— The ${site.name} team`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from, to: [message.to], subject: `Your ${site.name} onboarding form`, text }),
    });
    if (!res.ok) {
      console.error("Resend error (onboarding email)", { status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    // The link already exists: report "not emailed" so the Closer can copy it, rather than failing the send.
    console.error("Onboarding email request failed", { error: error instanceof Error ? error.name : "unknown" });
    return false;
  }
}
