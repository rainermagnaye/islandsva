import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { LeadDetail, LeadPage, LeadStatus, LeadSummary } from "./contract";
import type { LeadInput } from "./validation";

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
const SUMMARY_COLUMNS = "id, full_name, email, company_name, package_code, status, created_at";
// Lead ids are UUIDs; anything else in a URL is a 404, not a database error.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SummaryRow = { id: string; full_name: string; email: string; company_name: string | null; package_code: string | null; status: LeadStatus; created_at: string };

const toSummary = (row: SummaryRow): LeadSummary => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  companyName: row.company_name,
  packageCode: row.package_code,
  status: row.status,
  createdAt: row.created_at,
});

/**
 * Leads newest first, one page at a time, optionally with one status (pages start at 1; a page past the
 * end comes back empty). Backed by the (status, created_at) and (created_at) indexes.
 */
export async function listLeads({ page = 1, status, pageSize = PAGE_SIZE }: { page?: number; status?: LeadStatus; pageSize?: number } = {}): Promise<LeadPage> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase.from("leads").select(SUMMARY_COLUMNS, { count: "exact" });
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  // PostgREST answers a page past the end with "range not satisfiable" instead of an empty list.
  if (error?.code === "PGRST103") {
    const total = await countLeadsWith(status);
    return { leads: [], total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }
  if (error) throw new UpstreamError("supabase", `Listing leads failed: ${error.message}`, { cause: error });

  const total = count ?? 0;
  return { leads: data.map(toSummary), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** One lead with its message, or null if it doesn't exist (or isn't visible to the caller). */
export async function getLead(id: string): Promise<LeadDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(`${SUMMARY_COLUMNS}, message, updated_at`).eq("id", id).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading lead ${id} failed: ${error.message}`, { cause: error });
  return data && { ...toSummary(data), message: data.message, updatedAt: data.updated_at };
}

/**
 * Head-only count (no rows transferred), of every lead or of one status. Cached per request: the sidebar
 * badge and the overview both count new leads on the same render.
 */
const countLeadsWith = cache(async (status?: LeadStatus) => {
  const supabase = await createClient();
  let query = supabase.from("leads").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
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
export type ConvertRefusal = (typeof CONVERT_REFUSALS)[keyof typeof CONVERT_REFUSALS];

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
