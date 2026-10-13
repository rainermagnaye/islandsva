import "server-only";
import { site } from "@/content/site";
import { env } from "@/lib/env";
import { UpstreamError } from "@/lib/upstream-error";
import { ApiError } from "./errors";

type SiteverifyResult = {
  success?: boolean;
  hostname?: string;
  metadata?: { result_with_testing_key?: boolean };
};

const failed = () => new ApiError(403, "verification_failed", "Please complete the security check and try again.");

/**
 * Server-side Cloudflare Turnstile check. Required in production; skipped in local dev when no secret
 * is configured so the form can be exercised without Cloudflare. `requestHost` is the host the form was
 * served from — a valid token must have been issued there.
 */
export async function verifyTurnstile(token: string | null, ip: string | null, requestHost: string) {
  const secret = env.turnstileSecretKey();
  if (!secret) {
    if (env.isProduction()) throw new UpstreamError("turnstile", "TURNSTILE_SECRET_KEY is not set");
    return;
  }
  if (!token) throw failed();

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  let result: SiteverifyResult;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    result = (await res.json()) as SiteverifyResult;
  } catch (error) {
    // Cloudflare unreachable is our outage (503, retryable), not the visitor failing the check.
    throw new UpstreamError("turnstile", "siteverify request failed", { cause: error });
  }
  if (!result.success) throw failed();

  // Cloudflare's test keys pass everything and report hostname "example.com". Accept them anywhere except
  // the live deployment, where a test key would be a misconfiguration that lets every bot through.
  if (result.metadata?.result_with_testing_key) {
    if (env.isLiveDeployment()) throw new UpstreamError("turnstile", "Turnstile test keys are configured in production");
    return;
  }
  // A token minted on another site that reuses our site key must not count.
  const allowedHosts = new Set([requestHost, new URL(site.url).hostname]);
  if (!result.hostname || !allowedHosts.has(result.hostname)) throw failed();
}
