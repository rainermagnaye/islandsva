import { after } from "next/server";
import type { LeadCreated } from "@/features/leads/contract";
import { notifyNewLead, submitContactRequest } from "@/features/leads/service";
import { parseLead } from "@/features/leads/validation";
import { ApiError } from "@/lib/api/errors";
import { UpstreamError } from "@/lib/upstream-error";
import { createHandler } from "@/lib/api/handler";
import { hashIp } from "@/lib/api/ip-hash";
import { ok } from "@/lib/api/response";
import { verifyTurnstile } from "@/lib/api/turnstile";

// Contact form submissions: an enquiry with a picked discovery-call slot, or a plain enquiry while none is
// open. Rate limiting runs before this (Vercel Firewall rule on /api/v1/leads).
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

  let id: string;
  try {
    const stored = await submitContactRequest(parsed.value, parsed.startsAt, {
      ipHash: await hashIp(ip),
      userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
    });
    if (!stored.ok) throw new ApiError(422, "validation_failed", "Please check the highlighted fields.", { startsAt: stored.message });
    id = stored.id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery request failed", { service: error.service, error: error.message });
    throw new ApiError(503, "unavailable", options.unavailableMessage);
  }

  // Email runs after the response, so the visitor never waits on (or sees) a mail outage.
  after(() => notifyNewLead(id, parsed.value, parsed.startsAt ?? undefined));

  return ok<LeadCreated>({ ok: true }, 201);
});
