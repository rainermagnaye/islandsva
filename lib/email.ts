import "server-only";
import { env } from "@/lib/env";

/**
 * One plain-text email via Resend's REST API (no Supabase mailer, so it works before custom SMTP). Plain text, so
 * names and other input are never interpreted as HTML. Returns false — never throws — when email isn't configured,
 * Resend is unreachable or it refuses; logs only `label` and the status, never the address, body or a link.
 */
export async function sendPlainEmail(label: string, message: { to: string; subject: string; text: string; replyTo?: string }) {
  const apiKey = env.resendApiKey();
  const from = env.emailFrom();
  if (!apiKey || !from) {
    console.warn(`${label} skipped: RESEND_API_KEY or EMAIL_FROM is not set`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, ...(message.replyTo && { reply_to: message.replyTo }) }),
    });
    if (!res.ok) console.error(`Resend error (${label})`, { status: res.status });
    return res.ok;
  } catch (error) {
    console.error(`${label} request failed`, { error: error instanceof Error ? error.name : "unknown" });
    return false;
  }
}
