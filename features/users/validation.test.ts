import { describe, expect, it } from "vitest";
import { USER_LIMITS } from "./contract";
import { parseInvite } from "./validation";

const valid = { email: " Vi@Islandsva.com ", fullName: " Vi Santos ", role: "va" };

describe("parseInvite", () => {
  it("accepts a staff invite and normalises it", () => {
    expect(parseInvite(valid)).toEqual({ ok: true, value: { email: "vi@islandsva.com", fullName: "Vi Santos", role: "va" } });
  });

  it.each(["va", "closer", "admin"])("allows the %s role", (role) => {
    expect(parseInvite({ ...valid, role }).ok).toBe(true);
  });

  it("refuses the client role (clients are invited by a Closer) and unknown roles", () => {
    for (const role of ["client", "owner", ""]) {
      expect(parseInvite({ ...valid, role })).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    }
  });

  it("enforces the name limit and rejects control characters", () => {
    expect(parseInvite({ ...valid, fullName: "a".repeat(USER_LIMITS.fullName) }).ok).toBe(true);
    expect(parseInvite({ ...valid, fullName: "a".repeat(USER_LIMITS.fullName + 1) }).ok).toBe(false);
    expect(parseInvite({ ...valid, fullName: "Vi\u0000" }).ok).toBe(false);
  });

  it("rejects unknown keys as a form-level error", () => {
    expect(parseInvite({ ...valid, grantedBy: "me" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});
