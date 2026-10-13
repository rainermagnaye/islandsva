import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";

/**
 * Clients the signed-in user may see (RLS: all of them for an admin with two-factor sign-in).
 * Head-only count: no rows are transferred.
 */
export async function countClients() {
  const supabase = await createClient();
  const { count, error } = await supabase.from("clients").select("id", { count: "exact", head: true });
  if (error) throw new UpstreamError("supabase", `Counting clients failed: ${error.message}`, { cause: error });
  return count ?? 0;
}
