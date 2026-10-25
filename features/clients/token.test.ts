import { describe, expect, it } from "vitest";
import { createOnboardingToken, onboardingTokenHash } from "./token";

describe("onboarding token", () => {
  it("is 43 url-safe characters and hashes to 64 hex characters", () => {
    const token = createOnboardingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(onboardingTokenHash(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives every link its own token", () => {
    expect(createOnboardingToken()).not.toBe(createOnboardingToken());
  });
});
