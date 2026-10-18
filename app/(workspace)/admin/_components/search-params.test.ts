import { describe, expect, it } from "vitest";
import { disabledFrom, filterFrom, listHref, pageFrom } from "./search-params";

const OPTIONS = { new: "New", closed: "Closed" } as const;

describe("admin list search params", () => {
  it("reads ?page= as a positive integer, else 1", () => {
    expect(pageFrom("3")).toBe(3);
    expect(pageFrom(["2", "9"])).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "1.5", "abc", "1e3x"]) expect(pageFrom(bad)).toBe(1);
  });

  it("accepts only known ?status= values, never inherited keys", () => {
    expect(filterFrom("new", OPTIONS)).toBe("new");
    for (const bad of [undefined, "", "won", "toString", "__proto__"]) expect(filterFrom(bad, OPTIONS)).toBeUndefined();
  });

  it("builds list links without page 1 or empty filters", () => {
    expect(listHref("/admin/leads", {})).toBe("/admin/leads");
    expect(listHref("/admin/leads", { page: 1 })).toBe("/admin/leads");
    expect(listHref("/admin/leads", { status: "new", page: 2 })).toBe("/admin/leads?status=new&page=2");
    expect(listHref("/admin/leads", { disabled: true, status: "new" })).toBe("/admin/leads?disabled=1");
  });

  it("reads only ?disabled=1 as the disabled list", () => {
    expect(disabledFrom("1")).toBe(true);
    for (const bad of [undefined, "", "0", "true", "disabled"]) expect(disabledFrom(bad)).toBe(false);
  });
});
