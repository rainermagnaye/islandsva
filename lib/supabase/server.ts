import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { publicConfig, timedFetch } from "./config";

/**
 * Supabase acting as the signed-in visitor: publishable key + session cookie, so RLS applies.
 * Create one per request (never module-level) — it holds that request's cookies.
 */
export async function createClient() {
  // connection() first: everything the session client does runs at request time. cookies() alone isn't
  // enough — partial prefetching renders an App Shell *with* cookies, and auth-js checks token expiry
  // with Date.now(), which Next.js refuses to prerender (blocking-prerender-current-time).
  await connection();
  const cookieStore = await cookies();
  const { url, key } = publicConfig();
  return createServerClient<Database>(url, key, {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session on every app request,
          // so a token refreshed here is written there instead. Actions and Route Handlers succeed above.
        }
      },
    },
  });
}
