import { NextResponse, type NextRequest } from "next/server";
import { appRoutes } from "@/content/routes";
import { homeFor, rolesFromClaims } from "@/lib/auth/roles";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";
import { UpstreamError } from "@/lib/upstream-error";

// Runs only on sign-in and portal routes (see matcher) — public marketing pages stay static and never pay
// for it. Its redirects are convenience only: every page, action and query checks access itself.

const SIGNED_IN_ONLY = [appRoutes.dashboard, appRoutes.client, appRoutes.va, appRoutes.closer, appRoutes.admin, appRoutes.setPassword, appRoutes.mfa];
const SIGNED_OUT_ONLY = [appRoutes.login, appRoutes.forgotPassword];

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export async function proxy(request: NextRequest) {
  let session: Awaited<ReturnType<typeof updateSession>>;
  try {
    session = await updateSession(request);
  } catch (error) {
    // Supabase not configured: let the page render its own "unavailable" state instead of failing here.
    if (error instanceof UpstreamError) return NextResponse.next();
    throw error;
  }

  const { response, claims } = session;
  const { pathname, search } = request.nextUrl;

  if (!claims && SIGNED_IN_ONLY.some((base) => isUnder(pathname, base))) {
    return redirectWithSession(request, response, appRoutes.login, `?next=${encodeURIComponent(pathname + search)}`);
  }
  if (claims && SIGNED_OUT_ONLY.some((base) => isUnder(pathname, base))) {
    // Straight to their workspace (one redirect, not two via /dashboard); that page still checks access.
    return redirectWithSession(request, response, homeFor(rolesFromClaims(claims)) ?? appRoutes.dashboard);
  }
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/forgot-password",
    "/set-password",
    "/mfa",
    "/auth/:path*",
    "/dashboard",
    "/client/:path*",
    "/va/:path*",
    "/closer/:path*",
    "/admin/:path*",
  ],
};
