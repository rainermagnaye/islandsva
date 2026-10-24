import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import {
  clientBusinessFrom,
  clientBusinessToJson,
  type ClientBusiness,
  type ClientDetail,
  type ClientNote,
  type ClientPage,
  type ClientStatus,
} from "./contract";
import type { ClientDetailsInput } from "./validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads use the signed-in user's session, so RLS decides what they see: all clients for an admin with
// two-factor sign-in (a Closer only their own, a VA only their assigned ones — for later milestones).

const PAGE_SIZE = 25;

/** Head-only count (no rows transferred), of every visible client or of one status. */
export async function countClients(status?: ClientStatus) {
  return countMatching(status);
}

async function countMatching(status?: ClientStatus, search?: string, disabled = false) {
  const supabase = await createClient();
  let query = supabase.from("clients").select("id", { count: "exact", head: true });
  if (status && !disabled) query = query.eq("status", status);
  if (search) query = query.or(clientSearch(search));
  query = disabled ? query.not("disabled_at", "is", null) : query.is("disabled_at", null);
  const { count, error } = await query;
  if (error) throw new UpstreamError("supabase", `Counting clients failed: ${error.message}`, { cause: error });
  return count ?? 0;
}

/** `search` is already stripped of filter syntax by the page. */
function clientSearch(search: string) {
  const pattern = `%${search}%`;
  return `company_name.ilike."${pattern}",contact_name.ilike."${pattern}",contact_email.ilike."${pattern}"`;
}

/**
 * Clients newest first, one page at a time, optionally with one status and a company/name/email search
 * (pages start at 1; a page past the end comes back empty). `search` is already stripped of filter syntax
 * by the page. Backed by the (created_at) and (status, created_at) indexes.
 */
export async function listClients({
  page = 1,
  status,
  search,
  disabled = false,
  pageSize = PAGE_SIZE,
}: { page?: number; status?: ClientStatus; search?: string; disabled?: boolean; pageSize?: number } = {}): Promise<ClientPage> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("clients")
    .select("id, company_name, contact_name, contact_email, status, disabled_at, created_at, creator:profiles!clients_created_by_fkey(full_name, email)", { count: "exact" });
  if (status && !disabled) query = query.eq("status", status);
  if (search) query = query.or(clientSearch(search));
  const { data, error, count } = await (disabled ? query.not("disabled_at", "is", null) : query.is("disabled_at", null))
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  // PostgREST answers a page past the end with "range not satisfiable" instead of an empty list.
  if (error?.code === "PGRST103") {
    const total = await countMatching(status, search, disabled);
    return { clients: [], total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }
  if (error) throw new UpstreamError("supabase", `Listing clients failed: ${error.message}`, { cause: error });

  const total = count ?? 0;
  return {
    clients: data.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      status: row.status,
      disabledAt: row.disabled_at,
      // The creator's profile is always readable by an admin; "—" covers callers who can't see it.
      createdBy: row.creator?.full_name || row.creator?.email || "—",
      createdAt: row.created_at,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const DETAIL_COLUMNS =
  "id, company_name, contact_name, contact_email, contact_phone, status, created_at, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone, business, disabled_at, creator:profiles!clients_created_by_fkey(full_name, email)";

/** One client for the profile, or null when the id is unknown or not visible. */
export async function getClient(id: string): Promise<ClientDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading client ${id} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  return {
    id: data.id,
    companyName: data.company_name,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    status: data.status,
    createdBy: data.creator?.full_name || data.creator?.email || "—",
    createdAt: data.created_at,
    packageCode: data.package_code,
    hoursPerWeek: data.hours_per_week,
    termMonths: data.term_months,
    monthlyCents: data.monthly_cents,
    startsOn: data.starts_on,
    timezone: data.timezone,
    business: clientBusinessFrom(data.business),
    disabledAt: data.disabled_at,
  };
}

/**
 * A pending client with its agreed package, created as the signed-in Closer: RLS requires created_by to be
 * them, and the database checks they're an active Closer or admin.
 */
export async function insertClient(row: {
  createdBy: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  packageCode: string;
  hoursPerWeek: number;
  termMonths: number;
  monthlyCents: number;
  startsOn: string;
  timezone: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      created_by: row.createdBy,
      company_name: row.companyName,
      contact_name: row.contactName,
      contact_email: row.contactEmail,
      contact_phone: row.contactPhone,
      package_code: row.packageCode,
      hours_per_week: row.hoursPerWeek,
      term_months: row.termMonths,
      monthly_cents: row.monthlyCents,
      starts_on: row.startsOn,
      timezone: row.timezone,
    })
    .select("id")
    .single();
  if (error) throw new UpstreamError("supabase", `Creating a client failed: ${error.message}`, { cause: error });
  return data.id;
}

/** Writes the business details gathered from the lead. Contact columns stay as conversion set them. */
export async function saveClientBusiness(clientId: string, business: ClientBusiness) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ business: clientBusinessToJson(business) }).eq("id", clientId);
  if (error) throw new UpstreamError("supabase", `Saving client ${clientId} details failed: ${error.message}`, { cause: error });
}

/** Company details edited on the profile. */
export async function saveClientDetails(input: ClientDetailsInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      company_name: input.companyName,
      contact_name: input.contactName,
      contact_phone: input.contactPhone,
      business: clientBusinessToJson(input.business),
    })
    .eq("id", input.clientId)
    .select("id");
  if (error) throw new UpstreamError("supabase", `Saving client ${input.clientId} details failed: ${error.message}`, { cause: error });
  return data.length > 0;
}

const NOTE_REFUSALS = { IVA01: "not_found" } as const;

/** Notes newest first, with the author's name when this admin can read the profile. */
export async function listClientNotes(clientId: string): Promise<ClientNote[]> {
  if (!UUID.test(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_notes")
    .select("id, body, author_id, created_at, attachment_name, attachment_type")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Reading notes for ${clientId} failed: ${error.message}`, { cause: error });
  const names = await authorNames(data.map((row) => row.author_id));
  return data.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: names.get(row.author_id) ?? "Team member",
    createdAt: row.created_at,
    attachmentName: row.attachment_name,
    attachmentType: row.attachment_type,
  }));
}

async function authorNames(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) throw new UpstreamError("supabase", `Reading note authors failed: ${error.message}`, { cause: error });
  return new Map(data.map((row) => [row.id, row.full_name]));
}

/** A note, plus an optional file, on the client. */
export async function recordClientNote(clientId: string, body: string, file: { name: string; type: string; base64: string } | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_client_note", {
    client_id: clientId,
    body,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const refusal = NOTE_REFUSALS[error.code as keyof typeof NOTE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a client note failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** The file on one note, for an admin who can already read that client. */
export async function getClientNoteAttachment(clientId: string, noteId: string) {
  if (!UUID.test(clientId) || !UUID.test(noteId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_notes")
    .select("attachment_name, attachment_type, attachment_bytes")
    .eq("id", noteId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading a client attachment failed: ${error.message}`, { cause: error });
  if (!data?.attachment_name || !data.attachment_type || !data.attachment_bytes) return null;
  return { name: data.attachment_name, type: data.attachment_type, bytes: decodeBytea(data.attachment_bytes) };
}

function decodeBytea(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : /^[0-9a-fA-F]+$/.test(value) ? value : "";
  if (hex && hex.length % 2 === 0) return Uint8Array.from(Buffer.from(hex, "hex"));
  return Uint8Array.from(Buffer.from(value, "base64"));
}

/** Hides the client from the list, or puts them back. The record stays. */
export async function setClientDisabled(clientId: string, disabled: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ disabled_at: disabled ? new Date().toISOString() : null })
    .eq("id", clientId)
    .select("id");
  if (error) throw new UpstreamError("supabase", `Updating client ${clientId} failed: ${error.message}`, { cause: error });
  return data.length > 0;
}
