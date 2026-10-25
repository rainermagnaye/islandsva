import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import { leadProfileFrom, leadProfileToJson, type LeadDetail, type LeadEvent, type LeadEventKind, type LeadPage, type LeadStatus, type LeadSummary } from "./contract";
import type { ConvertNotedInput, LeadEditInput, LeadInput } from "./validation";

type NewLead = LeadInput & { ipHash: string | null; userAgent: string | null };

// Secret-key client: the visitor is anonymous and leads are server-only (no RLS policies). The route has
// already validated the input and passed the anti-spam checks.

export async function insertLead(lead: NewLead): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("leads")
    .insert({
      full_name: lead.name,
      email: lead.email,
      company_name: lead.company,
      industry: lead.industry,
      country: lead.country,
      message: lead.message,
      package_code: lead.packageSlug,
      ip_hash: lead.ipHash,
      user_agent: lead.userAgent,
    })
    .select("id")
    .single();
  if (error) throw new UpstreamError("supabase", `Insert into leads failed: ${error.message}`, { cause: error });
  return data.id;
}

export async function markLeadNotified(id: string) {
  const { error } = await createAdminClient().from("leads").update({ notified_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new UpstreamError("supabase", `Marking lead ${id} notified failed: ${error.message}`, { cause: error });
}

// Admin reads and writes below use the signed-in admin's session (not the secret key), so the database's
// own rules — admins with two-factor sign-in only — are enforced a second time.

const PAGE_SIZE = 25;
const SUMMARY_COLUMNS = "id, full_name, email, company_name, package_code, status, closer_id, created_at";
// Lead ids are UUIDs; anything else in a URL is a 404, not a database error.
type SummaryRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  package_code: string | null;
  status: LeadStatus;
  closer_id: string | null;
  created_at: string;
};

const toSummary = (row: SummaryRow, closerName: string | null): LeadSummary => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  companyName: row.company_name,
  packageCode: row.package_code,
  status: row.status,
  closerName,
  createdAt: row.created_at,
});

/** Names for the closers on this page. One read; a missing profile (deactivated, other tenant) stays unnamed. */
async function closerNames(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) throw new UpstreamError("supabase", `Reading closer names failed: ${error.message}`, { cause: error });
  return new Map(data.map((row) => [row.id, row.full_name]));
}

async function withClosers(rows: readonly SummaryRow[]) {
  const names = await closerNames(rows.flatMap((row) => (row.closer_id ? [row.closer_id] : [])));
  return rows.map((row) => toSummary(row, row.closer_id ? (names.get(row.closer_id) ?? null) : null));
}

/**
 * Leads newest first, one page at a time, optionally with one status and a name/email search (pages start
 * at 1; a page past the end comes back empty). Backed by the (status, created_at) and (created_at) indexes.
 * `search` is already stripped of filter syntax by the page.
 */
export async function listLeads({
  page = 1,
  status,
  search,
  disabled = false,
  pageSize = PAGE_SIZE,
}: { page?: number; status?: LeadStatus; search?: string; disabled?: boolean; pageSize?: number } = {}): Promise<LeadPage> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase.from("leads").select(SUMMARY_COLUMNS, { count: "exact" });
  if (status && !disabled) query = query.eq("status", status);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`full_name.ilike."${pattern}",email.ilike."${pattern}"`);
  }
  const { data, error, count } = await (disabled ? query.not("disabled_at", "is", null) : query.is("disabled_at", null))
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  // PostgREST answers a page past the end with "range not satisfiable" instead of an empty list.
  if (error?.code === "PGRST103") {
    const total = await countLeadsWith(status, search, disabled);
    return { leads: [], total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }
  if (error) throw new UpstreamError("supabase", `Listing leads failed: ${error.message}`, { cause: error });

  const total = count ?? 0;
  return { leads: await withClosers(data), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** A few leads matching a name, email, or company, newest first. Hidden leads stay out. */
export async function searchLeads(search: string, limit: number) {
  const supabase = await createClient();
  const pattern = `%${search}%`;
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, email, company_name")
    .is("disabled_at", null)
    .or(`full_name.ilike."${pattern}",email.ilike."${pattern}",company_name.ilike."${pattern}"`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new UpstreamError("supabase", `Searching leads failed: ${error.message}`, { cause: error });
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    companyName: row.company_name,
  }));
}

/** One lead with its message, or null if it doesn't exist (or isn't visible to the caller). */
export async function getLead(id: string): Promise<LeadDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(`${SUMMARY_COLUMNS}, industry, country, message, updated_at, disabled_at, profile`).eq("id", id).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading lead ${id} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  const names = await closerNames(data.closer_id ? [data.closer_id] : []);
  return {
    ...toSummary(data, data.closer_id ? (names.get(data.closer_id) ?? null) : null),
    industry: data.industry,
    country: data.country,
    message: data.message,
    updatedAt: data.updated_at,
    disabledAt: data.disabled_at,
    profile: leadProfileFrom(data.profile),
  };
}

/** Timeline rows, newest first, with the author's name when this admin can read the profile. */
export async function listLeadEvents(leadId: string): Promise<LeadEvent[]> {
  if (!isUuid(leadId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_events").select("id, kind, body, author_id, created_at, attachment_name, attachment_type").eq("lead_id", leadId).order("created_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Reading the timeline for ${leadId} failed: ${error.message}`, { cause: error });
  const names = await closerNames(data.map((row) => row.author_id));
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    authorName: names.get(row.author_id) ?? "Team member",
    createdAt: row.created_at,
    attachmentName: row.attachment_name,
    attachmentType: row.attachment_type,
  }));
}

/**
 * Head-only count (no rows transferred), of every lead or of one status. Cached per request: the sidebar
 * badge and the overview both count new leads on the same render.
 */
const countLeadsWith = cache(async (status?: LeadStatus, search?: string, disabled = false) => {
  const supabase = await createClient();
  let query = supabase.from("leads").select("id", { count: "exact", head: true });
  if (status && !disabled) query = query.eq("status", status);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`full_name.ilike."${pattern}",email.ilike."${pattern}"`);
  }
  const { count, error } = await (disabled ? query.not("disabled_at", "is", null) : query.is("disabled_at", null));
  if (error) throw new UpstreamError("supabase", `Counting leads failed: ${error.message}`, { cause: error });
  return count ?? 0;
});

/** Leads waiting for a first reply — the sidebar badge. */
export const countNewLeads = () => countLeadsWith("new");

/** Lead totals for the dashboard. */
export async function countLeads() {
  const [total, fresh] = await Promise.all([countLeadsWith(), countLeadsWith("new")]);
  return { total, new: fresh };
}

/**
 * Moves a lead to `to`, but only while its status is still one of `from` — checked in the same UPDATE, so
 * two admins acting at once (or a stale page) can't, say, reopen a lead someone just converted.
 * Returns false when nothing matched (the lead is gone or has moved on).
 */
export async function updateLeadStatus(id: string, to: LeadStatus, from: readonly LeadStatus[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ status: to }).eq("id", id).in("status", from).select("id");
  // IVA04: the database's own status guard refused the move (see the admin_leads_access migration).
  if (error?.code === "IVA04") return false;
  if (error) throw new UpstreamError("supabase", `Updating lead ${id} failed: ${error.message}`, { cause: error });
  return data.length > 0;
}

/** Why a conversion was refused, from convert_lead()'s own error codes (see the migration). */
const CONVERT_REFUSALS = { IVA01: "not_found", IVA02: "converted", IVA03: "closed" } as const;

/** Creates a pending client from a lead and marks the lead converted, in one database transaction. */
export async function convertLeadToClient(input: { leadId: string; companyName: string; contactName: string; contactPhone: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead", {
    lead_id: input.leadId,
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
  });
  if (error) {
    const refusal = CONVERT_REFUSALS[error.code as keyof typeof CONVERT_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Converting lead ${input.leadId} failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, clientId: data };
}

const STEP_REFUSALS = { IVA01: "not_found", IVA04: "unavailable" } as const;

/** Writes a timeline row and, for a pipeline step, moves the status. One database transaction. */
export async function recordLeadStep(leadId: string, kind: LeadEventKind, body: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_lead_step", { lead_id: leadId, kind, body });
  if (error) {
    const refusal = STEP_REFUSALS[error.code as keyof typeof STEP_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a lead step failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** Call summary or note, plus an optional file. A call moves the lead to contacted; a note leaves the status. */
export async function recordLeadFile(kind: "call" | "note", leadId: string, body: string, file: { name: string; type: string; base64: string } | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(kind === "call" ? "record_lead_call" : "record_lead_note", {
    lead_id: leadId,
    body,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const refusal = STEP_REFUSALS[error.code as keyof typeof STEP_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a call failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** The file on one timeline row, for an admin who can already read that lead. */
export async function getLeadAttachment(leadId: string, eventId: string) {
  if (!isUuid(leadId) || !isUuid(eventId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_events")
    .select("attachment_name, attachment_type, attachment_bytes")
    .eq("id", eventId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading an attachment failed: ${error.message}`, { cause: error });
  if (!data?.attachment_name || !data.attachment_type || !data.attachment_bytes) return null;
  return { name: data.attachment_name, type: data.attachment_type, bytes: decodeBytea(data.attachment_bytes) };
}

function decodeBytea(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : /^[0-9a-fA-F]+$/.test(value) ? value : "";
  if (hex && hex.length % 2 === 0) return Uint8Array.from(Buffer.from(hex, "hex"));
  return Uint8Array.from(Buffer.from(value, "base64"));
}

/** Converts the lead, stores the confirmed package on the client, and writes the remark. */
export async function convertLeadNoted(input: ConvertNotedInput & { monthlyCents: number; timezone: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead_noted", {
    lead_id: input.leadId,
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    remarks: input.remarks,
    package_code: input.packageSlug,
    hours_per_week: input.hoursPerWeek,
    term_months: input.termMonths,
    monthly_cents: input.monthlyCents,
    starts_on: input.startsOn,
    timezone: input.timezone,
  });
  if (error) {
    const refusal = CONVERT_REFUSALS[error.code as keyof typeof CONVERT_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    if (error.code === "IVA04") return { ok: false as const, reason: "unavailable" as const };
    throw new UpstreamError("supabase", `Converting lead ${input.leadId} failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, clientId: data };
}

/** Saves the details an admin is allowed to correct. Spam metadata stays as submitted. */
export async function updateLeadDetails(input: LeadEditInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({
      full_name: input.name,
      email: input.email,
      company_name: input.company,
      industry: input.industry,
      country: input.country,
      message: input.message,
      package_code: input.packageSlug,
      profile: leadProfileToJson(input.profile),
    })
    .eq("id", input.leadId)
    .select("id");
  if (error) throw new UpstreamError("supabase", `Updating lead ${input.leadId} failed: ${error.message}`, { cause: error });
  return data.length > 0;
}

export async function setLeadDisabled(leadId: string, disabled: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ disabled_at: disabled ? new Date().toISOString() : null })
    .eq("id", leadId)
    .select("id");
  if (error) throw new UpstreamError("supabase", `Updating lead ${leadId} failed: ${error.message}`, { cause: error });
  return data.length > 0;
}

/** Deletes a lead that is still new and has no timeline. The database refuses anything with history. */
export async function deleteLead(leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", leadId).select("id");
  if (error?.code === "IVA05") return { ok: false as const, reason: "history" as const };
  if (error) throw new UpstreamError("supabase", `Deleting lead ${leadId} failed: ${error.message}`, { cause: error });
  return data.length > 0 ? { ok: true as const } : { ok: false as const, reason: "not_found" as const };
}
