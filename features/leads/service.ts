import "server-only";
import { insertLead, markLeadNotified } from "./dal";
import { sendLeadNotification } from "./email";
import type { LeadInput } from "./validation";

/** Request metadata stored with a lead for abuse checks. Derived from the HTTP request by the route. */
export type LeadSource = { ipHash: string | null; userAgent: string | null };

/**
 * Stores a validated lead and returns its id. The single entry point for creating leads, so later rules
 * (duplicate checks, assigning a Closer) live here, not in each caller.
 */
export async function createLead(lead: LeadInput, source: LeadSource) {
  return insertLead({ ...lead, ...source });
}

/**
 * Emails the team about a stored lead and records that it was sent. Never throws: the lead is already
 * saved, so a mail outage is logged (notified_at stays null for follow-up) rather than surfaced to the visitor.
 */
export async function notifyNewLead(id: string, lead: LeadInput) {
  try {
    if (await sendLeadNotification(lead)) await markLeadNotified(id);
  } catch (error) {
    console.error("Lead notification failed", { id, error });
  }
}
