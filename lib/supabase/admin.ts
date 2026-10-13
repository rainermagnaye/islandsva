import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { UpstreamError } from "@/lib/upstream-error";
import type { Database } from "@/types/database";
import { timedFetch, validUrl } from "./config";

let client: SupabaseClient<Database> | undefined;

/**
 * Secret-key client. BYPASSES RLS — call only from features' dal.ts and auth admin services, after the
 * caller has been authorized. It holds no session, so one instance is safely reused across requests.
 */
export function createAdminClient() {
  if (client) return client;
  const url = validUrl(env.supabaseUrl());
  const key = env.supabaseSecretKey();
  if (!url || !key) throw new UpstreamError("supabase", "SUPABASE_URL (https) or SUPABASE_SECRET_KEY is not set");
  client = createClient<Database>(url, key, {
    global: { fetch: timedFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
