import { describe, expect, it } from "vitest";
import { inviteEligibility } from "./invite-eligibility";

const fresh = { status: "invited" as const, signedInAt: null };

describe("inviteEligibility", () => {
  it("allows an employee who hasn't signed in yet", () => {
    expect(inviteEligibility({ ...fresh, roles: ["va"] })).toBe("ok");
    expect(inviteEligibility({ ...fresh, roles: ["closer"] })).toBe("ok");
    expect(inviteEligibility({ ...fresh, roles: ["admin"] })).toBe("ok");
    expect(inviteEligibility({ ...fresh, roles: ["client", "va"] })).toBe("ok");
  });

  it("refuses a client-only login and an unknown account", () => {
    expect(inviteEligibility({ ...fresh, roles: ["client"] })).toBe("missing");
    expect(inviteEligibility({ ...fresh, roles: [] })).toBe("missing");
    expect(inviteEligibility(null)).toBe("missing");
  });

  it("refuses a disabled or already signed-in account", () => {
    expect(inviteEligibility({ roles: ["va"], status: "inactive", signedInAt: null })).toBe("exists");
    expect(inviteEligibility({ roles: ["va"], status: "invited", signedInAt: "2026-11-01T00:00:00Z" })).toBe("exists");
    expect(inviteEligibility({ roles: ["closer"], status: "active", signedInAt: "2026-11-01T00:00:00Z" })).toBe("exists");
  });
});
