import "server-only";
import { env } from "@/lib/env";
import { UpstreamError } from "@/lib/upstream-error";

/** An https URL, or undefined — so a placeholder like `https://<project-ref>.supabase.co` counts as unset. */
export function validUrl(value: string | undefined) {
  if (!value || !URL.canParse(value)) return undefined;
  return new URL(value).protocol === "https:" || value.startsWith("http://127.0.0.1") || value.startsWith("http://localhost") ? value : undefined;
}

/**
 * URL + publishable key. Missing or malformed config throws UpstreamError (logged, 503 / "unavailable")
 * so only the request that needs Supabase fails — never the proxy or the public site.
 */
export function publicConfig() {
  const url = validUrl(env.supabaseUrl());
  const key = env.supabasePublishableKey();
  if (!url || !key) throw new UpstreamError("supabase", "SUPABASE_URL (https) or SUPABASE_PUBLISHABLE_KEY is not set");
  return { url, key };
}

/** Bounds every Supabase request so a slow upstream fails fast instead of holding the function open. */
export const timedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8_000) });
