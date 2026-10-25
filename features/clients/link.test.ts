import { describe, expect, it } from "vitest";
import { onboardingUrl, originFrom } from "./link";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";

describe("registration link", () => {
  it("uses localhost when the request has no host", () => {
    expect(originFrom(null, null)).toBe("http://localhost:3000");
    expect(onboardingUrl(token, originFrom(null, null))).toBe(`http://localhost:3000/register/${token}`);
  });

  it("uses the address the admin has open", () => {
    expect(originFrom("localhost:3000", null)).toBe("http://localhost:3000");
    expect(onboardingUrl(token, originFrom("localhost:3000", null))).toBe(`http://localhost:3000/register/${token}`);
  });

  it("rejects a host that is not a single address", () => {
    expect(originFrom("evil.example/register", "https")).toBe("http://localhost:3000");
  });
});
