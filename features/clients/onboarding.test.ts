import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { onboardingState, type OnboardingLink } from "./contract";
import { ONBOARDING_TOKEN, createOnboardingToken, hashOnboardingToken } from "./onboarding-token";

describe("onboarding tokens", () => {
  it("are 256-bit, URL-safe, and stored only as their SHA-256", () => {
    const { token, hash } = createOnboardingToken();
    expect(token).toMatch(ONBOARDING_TOKEN);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).not.toContain(token);
  });

  it("never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createOnboardingToken().token));
    expect(tokens.size).toBe(200);
  });

  it("hash the same token the same way, and different tokens differently", () => {
    expect(hashOnboardingToken("a")).toBe(hashOnboardingToken("a"));
    expect(hashOnboardingToken("a")).not.toBe(hashOnboardingToken("b"));
  });

  it("only match the exact shape, so a mangled link is rejected before any lookup", () => {
    expect(ONBOARDING_TOKEN.test("x".repeat(43))).toBe(true);
    expect(ONBOARDING_TOKEN.test("x".repeat(42))).toBe(false);
    expect(ONBOARDING_TOKEN.test(`${"x".repeat(42)}/`)).toBe(false);
    expect(ONBOARDING_TOKEN.test(`${"x".repeat(42)}=`)).toBe(false);
  });
});

describe("onboardingState", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const link = (over: Partial<OnboardingLink> = {}): OnboardingLink => ({
    createdAt: "2026-10-24T10:00:00Z",
    expiresAt: "2026-10-31T10:00:00Z",
    submittedAt: null,
    revokedAt: null,
    ...over,
  });

  it("is not sent until a link exists", () => {
    expect(onboardingState(null, null, now)).toBe("not_sent");
  });

  it("is sent while the latest link is open", () => {
    expect(onboardingState(link(), null, now)).toBe("sent");
  });

  it("is expired once the latest link's time has passed", () => {
    expect(onboardingState(link({ expiresAt: "2026-10-24T12:00:00Z" }), null, now)).toBe("expired");
  });

  it("is withdrawn when the latest link was revoked", () => {
    expect(onboardingState(link({ revokedAt: "2026-10-24T11:00:00Z" }), null, now)).toBe("withdrawn");
  });

  it("is submitted when the client sent the form, whatever the latest link says", () => {
    expect(onboardingState(link({ submittedAt: "2026-10-24T11:00:00Z" }), null, now)).toBe("submitted");
    expect(onboardingState(link({ revokedAt: "2026-10-24T11:30:00Z" }), "2026-10-24T11:00:00Z", now)).toBe("submitted");
    expect(onboardingState(null, "2026-10-24T11:00:00Z", now)).toBe("submitted");
  });
});
