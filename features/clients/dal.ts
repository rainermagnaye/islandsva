import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { ClientPage, ClientStatus } from "./contract";

// Reads use the signed-in user's session, so RLS decides what they see: all clients for an admin with
// two-factor sign-in (a Closer only their own, a VA only their assigned ones — for later milestones).

const PAGE_SIZE = 25;

/** Head-only count (no rows transferred), of every visible client or of one status. */
export async function countClients(status?: ClientStatus) {
  const supabase = await createClient();
  let query = supabase.from("clients").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw new UpstreamError("supabase", `Counting clients failed: ${error.message}`, { cause: error });
  return count ?? 0;
}

/**
 * Clients newest first, one page at a time, optionally with one status (pages start at 1; a page past the
 * end comes back empty). Backed by the (created_at) and (status, created_at) indexes.
 */
export async function listClients({ page = 1, status, pageSize = PAGE_SIZE }: { page?: number; status?: ClientStatus; pageSize?: number } = {}): Promise<ClientPage> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("clients")
    .select("id, company_name, contact_name, contact_email, status, created_at, creator:profiles!clients_created_by_fkey(full_name, email)", { count: "exact" });
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  // PostgREST answers a page past the end with "range not satisfiable" instead of an empty list.
  if (error?.code === "PGRST103") {
    const total = await countClients(status);
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
      // The creator's profile is always readable by an admin; "—" covers callers who can't see it.
      createdBy: row.creator?.full_name || row.creator?.email || "—",
      createdAt: row.created_at,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
