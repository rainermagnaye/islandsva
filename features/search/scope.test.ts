import { describe, expect, it } from "vitest";
import { searchScopeFor } from "./scope";

describe("searchScopeFor", () => {
  it("gives admins their lists only with two-factor sign-in", () => {
    expect(searchScopeFor({ roles: ["admin"], aal: "aal2" })).toBe("admin");
    expect(searchScopeFor({ roles: ["super_admin", "admin"], aal: "aal2" })).toBe("admin");
    expect(searchScopeFor({ roles: ["admin"], aal: "aal1" })).toBeNull();
    // An admin who is also a Closer still needs two-factor; they never fall back to the Closer's view.
    expect(searchScopeFor({ roles: ["admin", "closer"], aal: "aal1" })).toBeNull();
  });

  it("scopes everyone else to their own records", () => {
    expect(searchScopeFor({ roles: ["closer"], aal: "aal1" })).toBe("closer");
    expect(searchScopeFor({ roles: ["va"], aal: "aal1" })).toBe("va");
    expect(searchScopeFor({ roles: ["client"], aal: "aal1" })).toBe("client");
    expect(searchScopeFor({ roles: [], aal: "aal2" })).toBeNull();
  });
});
