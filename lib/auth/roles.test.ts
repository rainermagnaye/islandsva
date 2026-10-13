import { describe, expect, it } from "vitest";
import { homeFor, rolesFromClaims, safeNextPath, workspacesFor } from "./roles";

describe("rolesFromClaims", () => {
  it("reads roles from app_metadata in precedence order", () => {
    expect(rolesFromClaims({ app_metadata: { roles: ["client", "admin", "va"] } })).toEqual(["admin", "va", "client"]);
  });

  it("drops unknown values and tolerates missing or malformed claims", () => {
    expect(rolesFromClaims({ app_metadata: { roles: ["superuser", "va"] } })).toEqual(["va"]);
    expect(rolesFromClaims({ app_metadata: { roles: "admin" } })).toEqual([]);
    expect(rolesFromClaims({ app_metadata: {} })).toEqual([]);
    expect(rolesFromClaims(null)).toEqual([]);
  });
});

describe("homeFor", () => {
  it("sends each role to its workspace, highest precedence first", () => {
    expect(homeFor(["client"])).toBe("/client");
    expect(homeFor(["va"])).toBe("/va");
    expect(homeFor(["closer"])).toBe("/admin");
    expect(homeFor(["client", "admin"])).toBe("/admin");
  });

  it("returns null for a user without roles", () => {
    expect(homeFor([])).toBeNull();
  });
});

describe("workspacesFor", () => {
  it("lists each workspace once (admin and closer share one)", () => {
    expect(workspacesFor(["admin", "closer", "va"])).toEqual([
      { role: "admin", href: "/admin" },
      { role: "va", href: "/va" },
    ]);
  });
});

describe("safeNextPath", () => {
  it("accepts same-site paths", () => {
    expect(safeNextPath("/admin/users?tab=team", "/dashboard")).toBe("/admin/users?tab=team");
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "admin",
    "/ok\nnext",
    "/" + "a".repeat(600),
    "",
  ])("rejects %j (open redirect)", (value) => {
    expect(safeNextPath(value, "/dashboard")).toBe("/dashboard");
  });

  it("rejects non-strings", () => {
    expect(safeNextPath(undefined, "/dashboard")).toBe("/dashboard");
    expect(safeNextPath(["/admin"], "/dashboard")).toBe("/dashboard");
  });
});
