import "server-only";
import { env } from "@/lib/env";
import { UpstreamError } from "@/lib/upstream-error";

/**
 * Server-only call to Supabase's REST API with the secret key. The secret key BYPASSES RLS —
 * import this only from a feature's dal.ts, after the API wrapper has validated and authorised the request.
 * Failures throw UpstreamError with the details; createHandler logs them once and answers 503.
 */
export async function supabaseRest(path: string, init: RequestInit & { prefer?: string }) {
  const url = env.supabaseUrl();
  const key = env.supabaseSecretKey();
  if (!url || !key) throw new UpstreamError("supabase", "SUPABASE_URL or SUPABASE_SECRET_KEY is not set");

  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  // Legacy service_role JWTs also need a bearer token; new sb_secret_ keys must not send one.
  if (!key.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  if (init.prefer) headers.set("Prefer", init.prefer);

  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new UpstreamError("supabase", `Request failed: ${path}`, { cause: error });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError("supabase", `HTTP ${res.status} on ${path}: ${body.slice(0, 500)}`);
  }
  return res;
}
