import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appRoutes } from "@/content/routes";
import type { LinkError } from "@/features/auth/contract";
import { verifyEmailLink } from "@/features/auth/dal";
import { UpstreamError } from "@/lib/upstream-error";

// Where the invite and password-reset emails land. Exchanges the one-time token for a session cookie, then
// sends the user to choose a password. It must be a GET (it's an email link) and so isn't a createHandler
// JSON endpoint; the token is single-use and short-lived, and only these two link types are accepted.
// Destinations are fixed — nothing from the URL decides where we redirect (no open redirect).

const LINK_TYPES = ["invite", "recovery"] as const;
type LinkType = (typeof LINK_TYPES)[number];

const isLinkType = (value: string | null): value is LinkType => LINK_TYPES.includes(value as LinkType);

async function verify(type: LinkType, tokenHash: string): Promise<LinkError | null> {
  try {
    const code = await verifyEmailLink(type, tokenHash);
    if (!code) return null;
    return code === "otp_expired" ? "expired" : "invalid";
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Supabase Auth unavailable", { service: error.service, error });
    return "unavailable";
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const failure = !tokenHash || tokenHash.length > 512 || !isLinkType(type) ? "invalid" : await verify(type, tokenHash);

  redirect(failure ? `${appRoutes.login}?error=${failure}` : appRoutes.setPassword);
}
