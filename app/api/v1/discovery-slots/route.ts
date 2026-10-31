import type { DiscoverySlots } from "@/features/leads/contract";
import { openDiscoverySlots } from "@/features/leads/service";
import { createGetHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// The contact form's open discovery-call times. Public and anonymous, so a Vercel Firewall rate limit runs
// before this, as for /api/v1/leads. The handler's same-page check reads request headers first, which keeps
// the route dynamic: slots are read per request (no-store), never prerendered with the secret key at build.
export const GET = createGetHandler({ unavailableMessage: "We couldn't load the open times. Please try again in a moment." }, async () =>
  ok<DiscoverySlots>({ slots: await openDiscoverySlots() }),
);
