import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import type { Database } from "@/types/database";
import { createAdminClient } from "./admin";
import { createClient } from "./server";

export type VisibleReader = {
  supabase: SupabaseClient<Database>;
  /** Set when the secret key is used: every query must stay inside this agency. */
  tenantId: string | null;
};

/**
 * Reads for portal lists and detail pages. A Lead Gen who is not also an admin sees the agency's leads,
 * clients and meetings — secret key after requireRole, because live RLS still returns only rows they own.
 * Always scoped to their tenant. Everyone else stays on the session so RLS checks again.
 */
export const createVisibleClient = cache(async (): Promise<VisibleReader> => {
  const user = await getSessionUser();
  const session = await createClient();
  if (!user?.roles.includes("closer") || user.roles.includes("admin")) {
    return { supabase: session, tenantId: null };
  }
  const { data, error } = await session.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the Lead Gen's agency failed: ${error.message}`, { cause: error });
  if (!data?.tenant_id) return { supabase: session, tenantId: null };
  return { supabase: createAdminClient(), tenantId: data.tenant_id };
});

export function forTenant<Q extends { eq: (column: string, value: string) => Q }>(query: Q, tenantId: string | null): Q {
  return tenantId ? query.eq("tenant_id", tenantId) : query;
}
