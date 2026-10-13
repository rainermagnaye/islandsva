import { after } from "next/server";
import type { LeadCreated } from "@/features/leads/contract";
import { createLead, notifyNewLead } from "@/features/leads/service";
import { parseLead } from "@/features/leads/validation";
import { ApiError } from "@/lib/api/errors";
import { createHandler } from "@/lib/api/handler";
import { hashIp } from "@/lib/api/ip-hash";
import { ok } from "@/lib/api/response";
import { verifyTurnstile } from "@/lib/api/turnstile";

// Contact form submissions. Rate limiting runs before this (Vercel Firewall rule on /api/v1/leads).
const options = {
  maxBytes: 10_000,
  unavailableMessage: "We couldn't send your message just now. Please try again in a moment.",
};

export const POST = createHandler(options, async ({ req, body, ip }) => {
  const parsed = parseLead(body);
  if (!parsed.ok) {
    if ("formError" in parsed) throw new ApiError(400, "invalid_request", parsed.formError);
    throw new ApiError(422, "validation_failed", "Please check the highlighted fields.", parsed.fieldErrors);
  }
  // Honeypot filled: answer like a success so bots learn nothing, store nothing.
  if (parsed.isBot) return ok<LeadCreated>({ ok: true }, 201);

  await verifyTurnstile(parsed.turnstileToken, ip, req.nextUrl.hostname);

  const id = await createLead(parsed.value, {
    ipHash: await hashIp(ip),
    userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
  });

  // Email runs after the response, so the visitor never waits on (or sees) a mail outage.
  after(() => notifyNewLead(id, parsed.value));

  return ok<LeadCreated>({ ok: true }, 201);
});
