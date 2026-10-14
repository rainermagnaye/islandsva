import { describe, expect, it } from "vitest";
import { classifyInviteError } from "./invite-result";

describe("classifyInviteError", () => {
  it("recognises an address that already has an account", () => {
    expect(classifyInviteError({ code: "email_exists", message: "already registered" })).toBe("exists");
  });

  it("recognises the mailer rate limit", () => {
    expect(classifyInviteError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toBe("rate");
    expect(classifyInviteError({ code: "over_request_rate_limit", message: "too many" })).toBe("rate");
  });

  it("leaves other failures for the outage path", () => {
    expect(classifyInviteError({ code: "unexpected_failure", message: "boom" })).toBeNull();
    expect(classifyInviteError({ code: "validation_failed", message: "redirect_to is not allowed" })).toBeNull();
  });
});
