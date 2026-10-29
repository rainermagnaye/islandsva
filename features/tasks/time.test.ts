import { describe, expect, it } from "vitest";
import type { WorkSession } from "./contract";
import { defaultDuration, delayedIds, formatMinutes, formatMs, hoursLabel, isDelayed, msBetween, packageWeek, remainingMs, runningSession, workedMs } from "./time";

const NOW = new Date("2026-10-29T06:00:00.000Z");
const session = (id: string, startedAt: string, endedAt: string | null): WorkSession => ({ id, taskId: "t1", startedAt, endedAt });

describe("work time", () => {
  it("gives each severity its starting duration", () => {
    expect([defaultDuration("low"), defaultDuration("medium"), defaultDuration("high")]).toEqual([30, 60, 120]);
  });

  it("adds up closed sessions and counts a running one to now", () => {
    const sessions = [session("a", "2026-10-29T01:00:00.000Z", "2026-10-29T01:20:00.000Z"), session("b", "2026-10-29T05:30:00.000Z", null)];
    expect(workedMs(sessions, NOW)).toBe(50 * 60_000);
    expect(runningSession(sessions)?.id).toBe("b");
    expect(runningSession(sessions.slice(0, 1))).toBeNull();
    expect(workedMs([], NOW)).toBe(0);
  });

  it("carries the remaining time over sessions and calls it delayed only past the duration", () => {
    const sessions = [session("a", "2026-10-29T01:00:00.000Z", "2026-10-29T01:20:00.000Z"), session("b", "2026-10-29T02:00:00.000Z", "2026-10-29T02:10:00.000Z")];
    expect(remainingMs(30, sessions, NOW)).toBe(0);
    expect(isDelayed(30, sessions, NOW)).toBe(false);
    expect(isDelayed(29, sessions, NOW)).toBe(true);
    expect(formatMs(remainingMs(25, sessions, NOW))).toBe("5 min");
  });

  it("takes the package week from Monday midnight in the client's zone", () => {
    // Thursday Oct 29, 2 pm in Manila: the week began Monday Oct 26, 00:00 Manila (Oct 25, 16:00 UTC).
    expect(packageWeek("Asia/Manila", NOW)).toEqual({ start: "2026-10-25T16:00:00.000Z", end: "2026-11-01T16:00:00.000Z", monday: "2026-10-26" });
    // New York is on daylight time until Nov 1: Monday Oct 26, 00:00 EDT is 04:00 UTC.
    expect(packageWeek("America/New_York", NOW).start).toBe("2026-10-26T04:00:00.000Z");
  });

  it("counts only the part of a session inside the week", () => {
    const week = packageWeek("Asia/Manila", NOW);
    const sessions = [
      session("before", "2026-10-25T15:30:00.000Z", "2026-10-25T16:30:00.000Z"),
      session("inside", "2026-10-28T01:00:00.000Z", "2026-10-28T02:00:00.000Z"),
      session("running", "2026-10-29T05:00:00.000Z", null),
    ];
    expect(msBetween(sessions, week.start, week.end, NOW)).toBe(150 * 60_000);
    expect(hoursLabel(msBetween(sessions, week.start, week.end, NOW))).toBe("2.5");
  });

  it("says a length the way people read it", () => {
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(60), formatMinutes(90), formatMinutes(125.9)]).toEqual(["0 min", "45 min", "1 h", "1 h 30 min", "2 h 5 min"]);
    expect(hoursLabel(0)).toBe("0");
    expect(hoursLabel(3 * 3_600_000)).toBe("3");
  });

  it("lists the tasks past their duration", () => {
    const sessions = new Map([
      ["late", [session("a", "2026-10-29T04:00:00.000Z", "2026-10-29T05:01:00.000Z")]],
      ["fine", [session("b", "2026-10-29T04:00:00.000Z", "2026-10-29T04:30:00.000Z")]],
    ]);
    const tasks = [
      { id: "late", durationMinutes: 60 },
      { id: "fine", durationMinutes: 60 },
      { id: "none", durationMinutes: 5 },
    ];
    expect([...delayedIds(tasks, sessions, NOW)]).toEqual(["late"]);
  });
});
