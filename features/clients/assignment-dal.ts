import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";

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
