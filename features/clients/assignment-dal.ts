import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { AssignedClient } from "./contract";

// A client's VA. Read and written with the signed-in session: admins with 2FA create and end assignments, a VA
// reads their own, a client their own record's (RLS). The database allows one active assignment per client and
// only a user with the VA role in it.

export type VaAssignment = { vaId: string; vaName: string; startedAt: string };

/** The active assignment, with the VA's name when the reader may see their profile (admins). */
export async function getActiveAssignment(clientId: string): Promise<VaAssignment | null> {
  if (!isUuid(clientId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_va_assignments")
    .select("va_id, started_at, va:profiles!client_va_assignments_va_id_fkey(full_name, email)")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the assignment for ${clientId} failed (${error.code})`);
  if (!data) return null;
  return { vaId: data.va_id, vaName: data.va?.full_name || data.va?.email || "Your VA", startedAt: data.started_at };
}

/** Assigns a VA. "taken" when the client already has one; "not_va" when the person isn't an active VA. */
export async function insertAssignment(clientId: string, vaId: string, assignedBy: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_va_assignments").insert({ client_id: clientId, va_id: vaId, assigned_by: assignedBy });
  if (error?.code === "23505") return { ok: false as const, reason: "taken" as const };
  if (error?.code === "23514" || error?.code === "23503") return { ok: false as const, reason: "not_va" as const };
  if (error?.code === "42501") return { ok: false as const, reason: "not_allowed" as const };
  if (error) throw new UpstreamError("supabase", `Assigning a VA failed (${error.code})`);
  return { ok: true as const };
}

/** Ends the client's active assignment, if any. History stays. */
export async function endActiveAssignment(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_va_assignments")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("status", "active")
    .select("id");
  if (error) throw new UpstreamError("supabase", `Ending the assignment for ${clientId} failed (${error.code})`);
  return data.length > 0;
}

/**
 * The assigned VA's first name, for the client's dashboard. Secret key: a client can't read employee profiles under
 * RLS. Called only with a va_id from an assignment the signed-in client just read under RLS, and returns only
 * the first name.
 */
export async function getVaFirstName(vaId: string) {
  if (!isUuid(vaId)) return null;
  const { data, error } = await createAdminClient().from("profiles").select("full_name").eq("id", vaId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the VA's name failed (${error.code})`);
  const first = data?.full_name.trim().split(/\s+/)[0];
  return first || null;
}

/**
 * The VA's active clients, newest assignment first. Signed-in session: RLS lets a VA read only their own
 * assignments and the clients behind them; the va_id filter keeps it to them even for a reader with more access.
 */
export async function listAssignedClients(vaId: string): Promise<AssignedClient[]> {
  // Named foreign key: clients is linked twice (client_id, and the (client_id, tenant_id) tenant key), so an
  // unnamed embed is ambiguous and PostgREST refuses it (PGRST201).
  if (!isUuid(vaId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_va_assignments")
    .select("started_at, client:clients!client_va_assignments_client_id_fkey!inner(id, company_name, contact_name, contact_email, timezone, hours_per_week)")
    .eq("va_id", vaId)
    .eq("status", "active")
    .order("started_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Listing assigned clients failed (${error.code})`);
  return data.map(({ started_at, client }) => ({
    id: client.id,
    companyName: client.company_name,
    contactName: client.contact_name,
    contactEmail: client.contact_email,
    timezone: client.timezone,
    hoursPerWeek: client.hours_per_week,
    startedAt: started_at,
  }));
}
