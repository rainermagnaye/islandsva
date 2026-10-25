import { describe, expect, it } from "vitest";
import { parseSearchQuery, searchTerm } from "./validation";

describe("searchTerm", () => {
  it("keeps a name and drops filter syntax", () => {
    expect(searchTerm("  Ann%_\\,().\"'Lee  ")).toBe("Ann Lee");
  });

  it("stops at 80 characters", () => {
    expect(searchTerm("a".repeat(90))).toHaveLength(80);
  });
});

describe("parseSearchQuery", () => {
  it("returns the cleaned term", () => {
    expect(parseSearchQuery({ q: "  ada  " })).toEqual({ ok: true, term: "ada" });
  });

  it("rejects anything that is not a single q string", () => {
    expect(parseSearchQuery({ q: "ada", extra: 1 }).ok).toBe(false);
    expect(parseSearchQuery({ q: 1 }).ok).toBe(false);
    expect(parseSearchQuery(null).ok).toBe(false);
  });
});
