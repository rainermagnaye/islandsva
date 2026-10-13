import "server-only";
import { LEAD_STATUSES, nextStatuses } from "./contract";
import { convertLeadToClient, insertLead, markLeadNotified, updateLeadStatus } from "./dal";
import { sendLeadNotification } from "./email";
import type { ConvertInput, LeadInput, LeadStatusInput } from "./validation";

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

/**
 * Turns a lead into a pending client (admin only — enforced by the caller and again by the database).
 * The client gets the lead's email and message; the admin confirms the company and contact names.
 * Sending the client a login invite is part of onboarding (M3), not conversion.
 */
export async function convertLead(input: ConvertInput) {
  return convertLeadToClient(input);
}

/**
 * Moves a lead along the triage flow (see nextStatuses). The allowed starting statuses are checked by the
 * database in the same UPDATE, so a lead converted or closed meanwhile is left alone (returns false).
 */
export async function setLeadStatus({ leadId, status }: LeadStatusInput) {
  const from = LEAD_STATUSES.filter((current) => nextStatuses(current).includes(status));
  return updateLeadStatus(leadId, status, from);
}
