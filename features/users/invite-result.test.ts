import { describe, expect, it } from "vitest";
import { classifyInviteError } from "./invite-result";

describe("classifyInviteError", () => {
  it("recognises an address that already has an account", () => {
    expect(classifyInviteError({ code: "email_exists", message: "already registered" }, true)).toBe("exists");
  });

  it("recognises the mailer rate limit", () => {
    expect(classifyInviteError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }, true)).toBe("rate");
    expect(classifyInviteError({ code: "over_request_rate_limit", message: "too many" }, false)).toBe("rate");
  });

  it("recognises a link address the project has not allowed, only when one was sent", () => {
    const error = { code: "validation_failed", message: "redirect_to is not allowed" };
    expect(classifyInviteError(error, true)).toBe("redirect");
    expect(classifyInviteError(error, false)).toBeNull();
  });

  it("leaves other failures for the outage path", () => {
    expect(classifyInviteError({ code: "unexpected_failure", message: "boom" }, true)).toBeNull();
  });
});
