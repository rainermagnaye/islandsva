import { describe, expect, it } from "vitest";
import { matchesBearer } from "./bearer";

describe("matchesBearer", () => {
  const secret = "s3cret-value-with-enough-length-1234";

  it("accepts exactly the configured secret", () => {
    expect(matchesBearer(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses a wrong, partial or differently-cased secret, another scheme, or no header", () => {
    for (const header of [`Bearer ${secret}x`, `Bearer ${secret.slice(0, -1)}`, `Bearer ${secret.toUpperCase()}`, `Basic ${secret}`, secret, "Bearer ", null]) {
      expect(matchesBearer(header, secret), String(header)).toBe(false);
    }
  });

  it("never matches when no secret is configured", () => {
    expect(matchesBearer("Bearer ", undefined)).toBe(false);
    expect(matchesBearer("Bearer ", "")).toBe(false);
    expect(matchesBearer("Bearer undefined", undefined)).toBe(false);
  });

  it("never matches a secret shorter than 32 characters", () => {
    expect(matchesBearer("Bearer short-secret", "short-secret")).toBe(false);
  });
});
