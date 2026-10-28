import { describe, expect, it } from "vitest";
import { greeting, longDay } from "./greeting";

describe("greeting", () => {
  it.each([
    ["2026-10-28T03:59:00.000Z", "Good morning"],
    ["2026-10-28T04:00:00.000Z", "Good afternoon"],
    ["2026-10-28T09:59:00.000Z", "Good afternoon"],
    ["2026-10-28T10:00:00.000Z", "Good evening"],
    ["2026-10-27T16:30:00.000Z", "Good morning"],
  ])("at %s in Manila says %s", (iso, words) => {
    expect(greeting(new Date(iso), "Asia/Manila")).toBe(words);
  });

  it("uses the client's own zone", () => {
    expect(greeting(new Date("2026-10-28T09:00:00.000Z"), "America/New_York")).toBe("Good morning");
  });
});

describe("longDay", () => {
  it("names today in the client's zone", () => {
    expect(longDay(new Date("2026-10-28T20:00:00.000Z"), "Asia/Manila")).toBe("Thursday, October 29");
  });
});
