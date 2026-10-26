import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { AssignedClient } from "./contract";

// A client's VAs. Read with the signed-in session. An admin with 2FA ends one assignment. Creating one happens
// when the client accepts a shortlist. Several VAs may be active. The name on the row is a snapshot.

export type VaAssignment = { id: string; vaId: string; vaName: string; startedAt: string };

/** Active assignments for one client. The name is the snapshot on the row, so a client can read it. */
export async function listActiveAssignments(clientId: string): Promise<VaAssignment[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_va_assignments")
    .select("id, va_id, va_first_name, started_at")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("started_at", { ascending: true });
  if (error) throw new UpstreamError("supabase", `Reading assignments for ${clientId} failed (${error.code})`);
  return data.map((row) => ({ id: row.id, vaId: row.va_id, vaName: row.va_first_name, startedAt: row.started_at }));
}

const OVERVIEW_PAGE = 1000;
const OVERVIEW_PAGES = 20;

export type ActiveAssignmentLoad = { vaId: string; clientId: string; hoursPerWeek: number | null };

/**
 * Active assignments whose client is active and not disabled. Hours stay on the client, so each VA
 * on that client carries the full week. Session only — no secret key.
 */
export async function listActiveAssignmentLoads(): Promise<ActiveAssignmentLoad[]> {
  const rows: ActiveAssignmentLoad[] = [];
  for (let page = 0; page < OVERVIEW_PAGES; page += 1) {
    const from = page * OVERVIEW_PAGE;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("client_va_assignments")
      .select("va_id, client_id, client:clients!client_va_assignments_client_id_fkey!inner(hours_per_week)")
      .eq("status", "active")
      .eq("client.status", "active")
      .is("client.disabled_at", null)
      .order("id")
      .range(from, from + OVERVIEW_PAGE - 1);
    if (error) throw new UpstreamError("supabase", `Reading VA load failed (${error.code})`);
    rows.push(
      ...data.map((row) => ({
        vaId: row.va_id,
        clientId: row.client_id,
        hoursPerWeek: row.client.hours_per_week,
      })),
    );
    if (data.length < OVERVIEW_PAGE) return rows;
  }
  throw new UpstreamError("supabase", "Reading VA load exceeded 20 pages");
}

/** Ends one active assignment. History stays. */
export async function endAssignment(assignmentId: string) {
  if (!isUuid(assignmentId)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_va_assignments")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("status", "active")
    .select("id");
  if (error) throw new UpstreamError("supabase", `Ending assignment ${assignmentId} failed (${error.code})`);
  return data.length > 0;
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
