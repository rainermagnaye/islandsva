import "server-only";
import { packages } from "@/content/packages";
import { businessFromEnquiry } from "@/features/clients/contract";
import { openClientRegistration } from "@/features/clients/service";
import { LEAD_STATUSES, nextStatuses } from "./contract";
import { convertLeadNoted, convertLeadToClient, deleteLead, getLead, insertLead, markLeadNotified, recordLeadFile, recordLeadStep, setLeadDisabled, updateLeadDetails, updateLeadStatus } from "./dal";
import { sendLeadNotification } from "./email";
import type { ConvertInput, ConvertNotedInput, LeadEditInput, LeadInput, LeadStatusInput, LeadStepInput } from "./validation";

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

/** Timeline entry, and the status move when the kind is a pipeline step. */
export async function logLeadStep(input: LeadStepInput) {
  return recordLeadStep(input.leadId, input.kind, input.body);
}

/** A call summary or a note, with the optional file stored on the same timeline row. */
export async function logLeadFile(kind: "call" | "note", leadId: string, body: string, file: { name: string; type: string; base64: string } | null) {
  return recordLeadFile(kind, leadId, body, file);
}

/**
 * Turns the lead into a client, stores the package they confirmed, and keeps the remarks on the timeline.
 * The monthly price comes from the catalogue, not from the form.
 */
export async function convertLeadWithRemarks(input: ConvertNotedInput) {
  const pkg = packages.find((item) => item.slug === input.packageSlug && item.weeklyHours === input.hoursPerWeek);
  if (!pkg) return { ok: false as const, reason: "package" as const };
  const result = await convertLeadNoted({ ...input, monthlyCents: pkg.monthlyPrice[input.termMonths] });
  if (!result.ok) return result;

  // The client row already exists. Copying the lead's details must not undo the conversion.
  try {
    const lead = await getLead(input.leadId);
    await openClientRegistration(result.clientId, businessFromEnquiry({
      industry: lead?.industry ?? null,
      country: lead?.country ?? null,
      message: lead?.message ?? "",
      jobTitle: lead?.profile.jobTitle ?? "",
      street: lead?.profile.street ?? "",
      city: lead?.profile.city ?? "",
      state: lead?.profile.state ?? "",
      zip: lead?.profile.zip ?? "",
      staffCount: lead?.profile.staffCount ?? "",
    }));
  } catch (error) {
    console.error("Client registration setup failed", { clientId: result.clientId, error });
  }
  return result;
}

export async function editLead(input: LeadEditInput) {
  return updateLeadDetails(input);
}

export async function pauseLead(leadId: string, disabled: boolean) {
  return setLeadDisabled(leadId, disabled);
}

export async function removeLead(leadId: string) {
  return deleteLead(leadId);
}
