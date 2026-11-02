import { after } from "next/server";
import { sendExpiryNotices } from "@/features/meetings/service";
import { matchesBearer } from "@/lib/api/bearer";
import { ok } from "@/lib/api/response";
import { env } from "@/lib/env";

// Called by the discovery-expiry job (Supabase pg_cron + pg_net, 20261102093000_discovery_expiry) when an expiry notice
// is due. Not createHandler: the caller is the database, not a page, so there is no Origin to check and no body. The
// bearer secret is the only access check; without it the route doesn't exist (404). The job has already expired the
// requests, so this only sends, after the response, so the database's HTTP call never waits on Resend.
export async function POST(req: Request) {
  if (!matchesBearer(req.headers.get("authorization"), env.discoveryExpirySecret())) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  after(sendExpiryNotices);
  return ok({ ok: true }, 202);
}
