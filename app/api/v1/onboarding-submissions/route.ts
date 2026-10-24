import { after } from "next/server";
import type { OnboardingSubmitted } from "@/features/clients/contract";
import { parseOnboarding } from "@/features/clients/onboarding-validation";
import { notifyOnboardingSubmitted, submitClientOnboarding } from "@/features/clients/service";
import { ApiError } from "@/lib/api/errors";
import { createHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// The client's onboarding form, sent from /onboarding/[token]. Anonymous: the single-use token in the body is the
// gate, so there is no Turnstile (a third-party script on a page whose URL carries a secret). Rate limiting is a
// Vercel Firewall rule on this path.
const options = {
  maxBytes: 16_000,
  unavailableMessage: "We couldn't save your form just now. Please try again in a moment.",
};

export const POST = createHandler(options, async ({ body }) => {
  const parsed = parseOnboarding(body);
  if (!parsed.ok) {
    if ("formError" in parsed) throw new ApiError(400, "invalid_request", parsed.formError);
    throw new ApiError(422, "validation_failed", "Please check the highlighted fields.", parsed.fieldErrors);
  }

  const result = await submitClientOnboarding(parsed.value);
  if (!result.ok) {
    // Unknown and used-up links look alike to the visitor; only someone holding the token learns which.
    if (result.reason === "unknown") throw new ApiError(404, "not_found", "This link isn't valid. Ask your Islands VA contact for a new one.");
    if (result.reason === "too_large") throw new ApiError(422, "too_large", "Some answers are longer than we can store. Please shorten the longest ones and send again.");
    throw new ApiError(410, "link_used", "This link has already been used or has expired. Ask your Islands VA contact for a new one.");
  }

  // The Closer's email runs after the response, so the client never waits on (or sees) a mail outage.
  after(() => notifyOnboardingSubmitted(result.clientId).catch((error: unknown) => console.error("Onboarding notice failed", { error })));
  return ok<OnboardingSubmitted>({ ok: true }, 201);
});
