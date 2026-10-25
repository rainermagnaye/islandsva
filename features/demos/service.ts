import "server-only";
import { findOwnClient } from "@/features/clients/service";
import { bookDemo, cancelDemo, decideDemo, type BookedDemo, type CancelledDemo, type DecidedDemo } from "./booking-dal";
import { sendDemoCancelledEmail, sendDemoDecisionEmail, sendDemoRequestEmail } from "./email";

// Demo use cases. Callers check the session first and pass the verified user; the database functions check
// the actor again. Emails are separate so callers can send them in after().

/** The signed-in client books a demo on one slot. */
export async function requestDemo(userId: string, slotId: string, note: string | null) {
  const client = await findOwnClient(userId);
  if (!client) return { ok: false as const, reason: "not_found" as const };
  return bookDemo(client.id, slotId, userId, note);
}

export function notifyDemoRequested(demo: BookedDemo) {
  return sendDemoRequestEmail({
    vaEmail: demo.va_email,
    vaName: demo.va_name,
    companyName: demo.company_name,
    startsAt: demo.starts_at,
    clientTimezone: demo.client_timezone,
    note: demo.client_note,
  });
}

/** The client cancels their own demo before it starts. */
export const withdrawDemo = (userId: string, bookingId: string) => cancelDemo(bookingId, userId);

export function notifyDemoCancelled(demo: CancelledDemo) {
  return sendDemoCancelledEmail({ vaEmail: demo.va_email, vaName: demo.va_name, companyName: demo.company_name, startsAt: demo.starts_at });
}

/** The booking's VA confirms or declines a request. */
export const answerDemo = (userId: string, bookingId: string, decision: "confirmed" | "rejected", reason: string | null) =>
  decideDemo(bookingId, userId, decision, reason);

/** Tells the client; skipped when the client has no login email (it always has one once active). */
export async function notifyDemoDecided(demo: DecidedDemo) {
  if (!demo.client_email) return false;
  return sendDemoDecisionEmail({
    clientEmail: demo.client_email,
    contactName: demo.contact_name,
    companyName: demo.company_name,
    startsAt: demo.starts_at,
    clientTimezone: demo.client_timezone,
    vaName: demo.va_name,
    confirmed: demo.status === "confirmed",
    reason: demo.reject_reason,
  });
}
