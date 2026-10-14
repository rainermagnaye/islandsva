import { describe, expect, it } from "vitest";
import { currentPath } from "./use-current-path";

describe("currentPath", () => {
  it("marks the page itself", () => {
    expect(currentPath("/admin/leads", "/admin/leads")).toBe("page");
    expect(currentPath("/pricing", "/pricing", true)).toBe("page");
  });

  it("marks the section for pages below it, unless exact", () => {
    expect(currentPath("/admin/leads/8f1d2c3b", "/admin/leads")).toBe("section");
    expect(currentPath("/admin/leads/8f1d2c3b", "/admin/leads", true)).toBeUndefined();
  });

  it("never matches a sibling that only shares a prefix", () => {
    expect(currentPath("/admin/leadsx", "/admin/leads")).toBeUndefined();
    expect(currentPath("/admin/clients", "/admin")).toBe("section");
    expect(currentPath("/admin/clients", "/admin", true)).toBeUndefined();
  });
});
