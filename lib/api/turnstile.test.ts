import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";
import { ApiError } from "./errors";
import { verifyTurnstile } from "./turnstile";

// site.url is https://islandsva.com unless NEXT_PUBLIC_SITE_URL says otherwise (.env sets the same).
const SITE_HOST = "islandsva.com";

function siteverify(result: object) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(result)));
}

const verify = (requestHost = SITE_HOST) => verifyTurnstile("token", null, requestHost);

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  vi.stubEnv("VERCEL_ENV", "preview");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("accepts a token issued on the site's domain", async () => {
    siteverify({ success: true, hostname: SITE_HOST });
    await expect(verify()).resolves.toBeUndefined();
  });

  it("refuses a failed check and a missing token", async () => {
    siteverify({ success: false });
    await expect(verify()).rejects.toBeInstanceOf(ApiError);
    await expect(verifyTurnstile(null, null, SITE_HOST)).rejects.toBeInstanceOf(ApiError);
  });

  it("refuses a token minted on another site that reuses our key", async () => {
    siteverify({ success: true, hostname: "evil.example" });
    await expect(verify()).rejects.toBeInstanceOf(ApiError);
  });

  it("accepts the serving host off the live site (staging, previews)", async () => {
    siteverify({ success: true, hostname: "islandsva-staging.vercel.app" });
    await expect(verify("islandsva-staging.vercel.app")).resolves.toBeUndefined();
  });

  it("refuses another alias of the live deployment, even when the form was served there", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    siteverify({ success: true, hostname: "islandsva.vercel.app" });
    await expect(verify("islandsva.vercel.app")).rejects.toBeInstanceOf(ApiError);
  });

  it("accepts the site's domain on the live deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    siteverify({ success: true, hostname: SITE_HOST });
    await expect(verify()).resolves.toBeUndefined();
  });

  it("refuses test keys only on the live deployment", async () => {
    siteverify({ success: true, hostname: "example.com", metadata: { result_with_testing_key: true } });
    await expect(verify()).resolves.toBeUndefined();
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(verify()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("treats Cloudflare unreachable as an outage, not a failed check", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(verify()).rejects.toBeInstanceOf(UpstreamError);
  });
});
