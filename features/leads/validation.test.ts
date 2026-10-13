import { describe, expect, it } from "vitest";
import { LEAD_LIMITS } from "./contract";
import { parseLead } from "./validation";

const valid = {
  name: "  Ana Cruz ",
  email: " Ana@Example.COM ",
  company: "",
  package: "executive",
  message: "Inbox help, please.",
  website: "",
  turnstileToken: "token",
};

describe("parseLead", () => {
  it("accepts a valid lead, trimming and normalising it", () => {
    const result = parseLead(valid);
    expect(result).toEqual({
      ok: true,
      value: { name: "Ana Cruz", email: "ana@example.com", company: null, packageSlug: "executive", message: "Inbox help, please." },
      isBot: false,
      turnstileToken: "token",
    });
  });

  it("accepts only the required fields", () => {
    expect(parseLead({ name: "Ana", email: "a@b.co", message: "Hi" }).ok).toBe(true);
  });

  it("accepts values exactly at each limit and rejects one over", () => {
    expect(parseLead({ ...valid, name: "a".repeat(LEAD_LIMITS.name) }).ok).toBe(true);
    expect(parseLead({ ...valid, name: "a".repeat(LEAD_LIMITS.name + 1) })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(parseLead({ ...valid, message: "a".repeat(LEAD_LIMITS.message + 1) })).toMatchObject({ ok: false, fieldErrors: { message: expect.any(String) } });
  });

  it("reports every invalid field at once", () => {
    const result = parseLead({ ...valid, name: " ", email: "nope", package: "gold" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), email: expect.any(String), package: expect.any(String) } });
  });

  it("rejects control characters, but allows line breaks in the message", () => {
    expect(parseLead({ ...valid, name: "A\u0007na" }).ok).toBe(false);
    expect(parseLead({ ...valid, message: "line one\nline two\ttab" }).ok).toBe(true);
  });

  it("rejects wrong types as field errors", () => {
    expect(parseLead({ ...valid, company: 5 })).toMatchObject({ ok: false, fieldErrors: { company: expect.any(String) } });
  });

  it.each([
    ["an unknown key", { ...valid, admin: true }],
    ["a non-object", [valid]],
    ["null", null],
    ["a non-string honeypot", { ...valid, website: 1 }],
    ["an oversized token", { ...valid, turnstileToken: "t".repeat(4097) }],
  ])("returns a form-level error for %s", (_, input) => {
    expect(parseLead(input)).toMatchObject({ ok: false, formError: expect.any(String) });
  });

  it("flags a filled honeypot as a bot without failing validation", () => {
    expect(parseLead({ ...valid, website: "spam.example" })).toMatchObject({ ok: true, isBot: true });
  });
});
