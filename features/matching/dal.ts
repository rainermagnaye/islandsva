import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { ShortlistEntry, ShortlistStatus, WorkingWindow } from "./contract";
import { toProfile, type OfferedProfile } from "./profile";

export type MatchWrite = { ok: true } | { ok: false; form: "offer" | "decided" | "hours" | "missing" };

const ENTRY = "id, client_id, va_id, status, va_first_name, company_name, created_at";

function refusal(code: string | undefined): MatchWrite | null {
  if (code === "IVA26") return { ok: false, form: "offer" };
  if (code === "IVA27") return { ok: false, form: "decided" };
  if (code === "IVA29") return { ok: false, form: "hours" };
  return null;
}

function toEntry(row: {
  id: string;
  client_id: string;
  va_id: string;
  status: ShortlistStatus;
  va_first_name: string;
  company_name: string;
  created_at: string;
}): ShortlistEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    vaId: row.va_id,
    status: row.status,
    vaFirstName: row.va_first_name,
    companyName: row.company_name,
    createdAt: row.created_at,
  };
}

export async function listShortlist(clientId: string): Promise<ShortlistEntry[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("va_shortlists").select(ENTRY).eq("client_id", clientId).order("created_at", { ascending: true });
  if (error) throw new UpstreamError("supabase", `Reading the shortlist for ${clientId} failed (${error.code})`);
  return data.map(toEntry);
}

/**
 * The work profiles of the VAs offered to the signed-in client. offered_va_profiles returns rows only for a
 * signed-in client and only for their own shortlist, and no personal details (see its migration).
 */
export async function listOfferedProfiles(): Promise<OfferedProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offered_va_profiles");
  if (error) throw new UpstreamError("supabase", `Reading offered VA profiles failed (${error.code})`);
  return (data ?? []).map(toProfile);
}

export async function offerVa(clientId: string, vaId: string, offeredBy: string): Promise<MatchWrite> {
  const supabase = await createClient();
  const { error } = await supabase.from("va_shortlists").insert({ client_id: clientId, va_id: vaId, offered_by: offeredBy });
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    if (error.code === "42501") return { ok: false, form: "offer" };
    throw new UpstreamError("supabase", `Offering a VA failed (${error.code})`);
  }
  return { ok: true };
}

export async function decideOffer(shortlistId: string, status: "accepted" | "declined"): Promise<MatchWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("va_shortlists").update({ status }).eq("id", shortlistId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deciding an offer failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, form: "missing" };
  return { ok: true };
}

export async function withdrawOffer(shortlistId: string): Promise<MatchWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("va_shortlists").delete().eq("id", shortlistId).eq("status", "offered").select("id");
  if (error) throw new UpstreamError("supabase", `Withdrawing an offer failed (${error.code})`);
  if (data.length === 0) return { ok: false, form: "missing" };
  return { ok: true };
}

export async function listWorkingHours(vaId: string): Promise<WorkingWindow[]> {
  if (!isUuid(vaId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("va_working_hours").select("id, weekday, start_minute, end_minute").eq("va_id", vaId).order("weekday");
  if (error) throw new UpstreamError("supabase", `Reading working hours failed (${error.code})`);
  return data.map((row) => ({ id: row.id, weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute }));
}

export async function saveWorkingHours(vaId: string, weekday: number, startMinute: number, endMinute: number): Promise<MatchWrite> {
  const supabase = await createClient();
  const existing = await supabase.from("va_working_hours").select("id").eq("va_id", vaId).eq("weekday", weekday).maybeSingle();
  if (existing.error) throw new UpstreamError("supabase", `Reading a working window failed (${existing.error.code})`);
  const write = existing.data
    ? await supabase.from("va_working_hours").update({ start_minute: startMinute, end_minute: endMinute }).eq("id", existing.data.id).select("id")
    : await supabase.from("va_working_hours").insert({ va_id: vaId, weekday, start_minute: startMinute, end_minute: endMinute }).select("id");
  if (write.error) {
    const refused = refusal(write.error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Saving working hours failed (${write.error.code})`);
  }
  if (write.data.length === 0) return { ok: false, form: "hours" };
  return { ok: true };
}

export async function removeWorkingHours(vaId: string, weekday: number): Promise<MatchWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("va_working_hours").delete().eq("va_id", vaId).eq("weekday", weekday).select("id");
  if (error) throw new UpstreamError("supabase", `Removing working hours failed (${error.code})`);
  if (data.length === 0) return { ok: false, form: "missing" };
  return { ok: true };
}
