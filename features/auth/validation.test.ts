import { describe, expect, it } from "vitest";
import { PASSWORD_RULES } from "./contract";
import { parseEmail, parseMfaCode, parseNewPassword, parseSignIn } from "./validation";

describe("parseSignIn", () => {
  it("accepts credentials and normalises the email", () => {
    expect(parseSignIn({ email: " Ada@X.co ", password: "anything" })).toEqual({ ok: true, value: { email: "ada@x.co", password: "anything" } });
  });

  it("keeps an optional return path for the action to validate", () => {
    expect(parseSignIn({ email: "a@b.co", password: "p", next: "/admin" })).toMatchObject({ ok: true, value: { next: "/admin" } });
  });

  it("requires both fields", () => {
    expect(parseSignIn({ email: "", password: "" })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String), password: expect.any(String) } });
  });

  it("rejects a password over the bcrypt limit", () => {
    expect(parseSignIn({ email: "a@b.co", password: "a".repeat(PASSWORD_RULES.max + 1) })).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
  });

  it("rejects unknown keys as a form-level error", () => {
    expect(parseSignIn({ email: "a@b.co", password: "p", role: "admin" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseEmail", () => {
  it("validates the address", () => {
    expect(parseEmail({ email: "a@b.co" }).ok).toBe(true);
    expect(parseEmail({ email: "nope" })).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
  });
});

describe("parseNewPassword", () => {
  const good = "islands2026va";

  it("accepts a strong, confirmed password", () => {
    expect(parseNewPassword({ password: good, confirmPassword: good }).ok).toBe(true);
  });

  it.each([
    ["too short", "abc123"],
    ["no number", "islandsvaonly"],
    ["no letter", "12345678901"],
    ["too long", "a1".repeat(40)],
  ])("rejects a password that is %s", (_, password) => {
    expect(parseNewPassword({ password, confirmPassword: password })).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
  });

  it("reports a mismatch on the confirmation field", () => {
    expect(parseNewPassword({ password: good, confirmPassword: `${good}x` })).toMatchObject({
      ok: false,
      fieldErrors: { confirmPassword: "The passwords don't match." },
    });
  });
});

describe("parseMfaCode", () => {
  const factorId = "0f2d6c1e-7a3b-4c5d-8e9f-001122334455";

  it("accepts a 6-digit code", () => {
    expect(parseMfaCode({ factorId, code: " 123456 " })).toEqual({ ok: true, value: { factorId, code: "123456" } });
  });

  it("rejects malformed codes on the code field", () => {
    for (const code of ["12345", "1234567", "12a456"]) {
      expect(parseMfaCode({ factorId, code })).toMatchObject({ ok: false, fieldErrors: { code: expect.any(String) } });
    }
  });

  it("rejects a malformed factor id as a form-level error", () => {
    expect(parseMfaCode({ factorId: "not-a-uuid", code: "123456" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});
