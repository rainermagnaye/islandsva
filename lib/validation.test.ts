import { describe, expect, it } from "vitest";
import { utcDay } from "./validation";

describe("utcDay", () => {
  it("reads a calendar day as its UTC midnight", () => {
    expect(utcDay("2026-10-27")).toBe(Date.UTC(2026, 9, 27));
    expect(utcDay("2028-02-29")).toBe(Date.UTC(2028, 1, 29));
  });

  it("refuses days that don't exist or aren't days", () => {
    expect(utcDay("2026-02-29")).toBeNull();
    expect(utcDay("2026-13-01")).toBeNull();
    expect(utcDay("2026-04-31")).toBeNull();
    expect(utcDay("")).toBeNull();
    expect(utcDay("not-a-day")).toBeNull();
  });
});
