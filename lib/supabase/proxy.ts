import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicConfig, timedFetch } from "./config";

/**
 * Refreshes the session cookie (Server Components can't write cookies) and returns the verified claims.
 * Returns `response` — or copy its cookies onto any other response — or the browser and server sessions
 * drift apart and users get signed out at random.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = publicConfig();

  // A new client per request: it holds this request's cookies.
  const supabase = createServerClient<Database>(url, key, {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache headers stop a CDN from caching a response that carries a refreshed session cookie.
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // Nothing may run between creating the client and getClaims(): it is what refreshes the token.
  const { data } = await supabase.auth.getClaims();
  return { response, claims: data?.claims ?? null };
}

/** A redirect that keeps any refreshed session cookies from `from`. */
export function redirectWithSession(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
