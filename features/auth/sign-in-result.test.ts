import { describe, expect, it } from "vitest";
import { SIGN_IN_MESSAGES, signInFailure } from "./sign-in-result";

describe("signInFailure", () => {
  it("gives every credential failure one message and logs nothing (no account enumeration)", () => {
    expect(signInFailure("invalid_credentials")).toEqual({ message: SIGN_IN_MESSAGES.credentials, report: null });
  });

  it("tells a rate-limited visitor to wait", () => {
    expect(signInFailure("over_request_rate_limit")).toEqual({ message: SIGN_IN_MESSAGES.rateLimited, report: null });
  });

  it("reports project misconfiguration as unavailable, not as something to retry", () => {
    // email_provider_disabled: the Email provider switched off in the Supabase dashboard (2026-10-14).
    for (const code of ["email_provider_disabled", "provider_disabled", "invalid_api_key"]) {
      expect(signInFailure(code)).toEqual({ message: SIGN_IN_MESSAGES.unavailable, report: "configuration" });
    }
  });

  it("flags codes it doesn't know so they get logged and mapped", () => {
    expect(signInFailure("some_new_code")).toEqual({ message: SIGN_IN_MESSAGES.unknown, report: "unexpected" });
  });
});
