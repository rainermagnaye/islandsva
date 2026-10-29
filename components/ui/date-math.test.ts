import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clockLabel,
  convertWallClock,
  formatDate,
  isIsoDate,
  isSelectable,
  layoutDay,
  minutesOf,
  monthGrid,
  offsetMinutes,
  partOfDay,
  startOfWeek,
  todayIn,
  wallClockIn,
  zoneCity,
} from "./date-math";

describe("calendar dates", () => {
  it("adds days and months across month and year edges, clamping to the month's last day", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("builds six full weeks starting on Sunday or Monday", () => {
    const sunday = monthGrid("2026-10-16", 0);
    expect(sunday).toHaveLength(6);
    expect(sunday[0][0]).toBe("2026-09-27");
    expect(sunday[0][4]).toBe("2026-10-01");
    expect(monthGrid("2026-10-16", 1)[0][0]).toBe("2026-09-28");
    expect(startOfWeek("2026-10-16", 1)).toBe("2026-10-12");
  });

  it("knows today in a zone, which can differ from the viewer's", () => {
    const now = new Date("2026-10-16T20:00:00Z");
    expect(todayIn("Asia/Manila", now)).toBe("2026-10-17");
    expect(todayIn("America/New_York", now)).toBe("2026-10-16");
  });

  it("checks limits and disabled days, and validates ISO dates", () => {
    const weekends = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
    expect(isSelectable("2026-10-16", { min: "2026-10-16", max: "2026-10-31" })).toBe(true);
    expect(isSelectable("2026-10-15", { min: "2026-10-16" })).toBe(false);
    expect(isSelectable("2026-11-01", { max: "2026-10-31" })).toBe(false);
    expect(isSelectable("2026-10-17", { isDateDisabled: weekends })).toBe(false);
    expect(isIsoDate("2026-10-16")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("formats a date without shifting it to the viewer's zone", () => {
    expect(formatDate("2026-10-19", { weekday: "short", month: "short", day: "numeric", year: "numeric" })).toBe("Mon, Oct 19, 2026");
  });
});

describe("times and zones", () => {
  it("reads and labels wall-clock minutes", () => {
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("2026-10-16T21:15")).toBe(1275);
    expect(clockLabel(540)).toBe("9 am");
    expect(clockLabel(1290)).toBe("9:30 pm");
    expect(clockLabel(0)).toBe("12 am");
    expect(partOfDay("2026-10-16T11:30")).toBe("morning");
    expect(partOfDay("2026-10-16T16:30")).toBe("afternoon");
    expect(partOfDay("2026-10-16T17:00")).toBe("evening");
  });

  it("converts a wall-clock time between zones, across daylight saving", () => {
    expect(offsetMinutes("Asia/Manila", new Date("2026-10-16T00:00:00Z"))).toBe(480);
    expect(convertWallClock("2026-10-15T21:00", "America/New_York", "Asia/Manila")).toEqual({ date: "2026-10-16", time: "09:00" });
    // New York leaves daylight saving on Nov 1, 2026: 9 pm is then UTC-5.
    expect(convertWallClock("2026-11-05T21:00", "America/New_York", "Asia/Manila")).toEqual({ date: "2026-11-06", time: "10:00" });
    expect(convertWallClock("2026-10-16T09:00", "Asia/Manila", "Asia/Manila")).toEqual({ date: "2026-10-16", time: "09:00" });
    expect(wallClockIn("2026-11-03T01:30:00.000Z", "Asia/Manila")).toBe("2026-11-03T09:30");
    expect(wallClockIn("2026-11-03T01:30:00.000Z", "America/New_York")).toBe("2026-11-02T20:30");
  });
});

describe("layoutDay", () => {
  const ev = (id: string, start: string, end: string) => ({ id, start: `2026-10-14T${start}`, end: `2026-10-14T${end}` });

  it("keeps separate events full width and splits overlapping ones side by side", () => {
    const placed = layoutDay([ev("a", "09:00", "10:00"), ev("b", "09:30", "10:30"), ev("c", "11:00", "12:00")]);
    const by = Object.fromEntries(placed.map((p) => [p.event.id, { lane: p.lane, lanes: p.lanes }]));
    expect(by.a).toEqual({ lane: 0, lanes: 2 });
    expect(by.b).toEqual({ lane: 1, lanes: 2 });
    expect(by.c).toEqual({ lane: 0, lanes: 1 });
  });

  it("reuses a lane once it frees up inside one cluster", () => {
    const placed = layoutDay([ev("a", "09:00", "11:00"), ev("b", "09:00", "09:30"), ev("c", "09:30", "10:00")]);
    const by = Object.fromEntries(placed.map((p) => [p.event.id, p.lane]));
    expect(by).toEqual({ a: 0, b: 1, c: 1 });
    expect(new Set(placed.map((p) => p.lanes))).toEqual(new Set([2]));
  });
});

describe("zoneCity", () => {
  it("names the city of a zone for a label", () => {
    expect(zoneCity("America/New_York")).toBe("New York");
    expect(zoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(zoneCity("UTC")).toBe("UTC");
  });
});
