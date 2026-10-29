import { describe, expect, it } from "vitest";
import type { WorkSession } from "./contract";
import type { TaskMetric } from "./metrics";
import { dueToday, hoursOf, hoursStatus, msByClient, trendStart, weeklyFigures } from "./weekly";

// Thu Oct 29, 2026, 2:00 pm in Manila. That week starts Mon Oct 26, 00:00 Manila = Oct 25, 16:00 UTC.
const NOW = new Date("2026-10-29T06:00:00.000Z");
const MANILA = "Asia/Manila";
const HOUR = 3_600_000;

const task = (over: Partial<TaskMetric> = {}): TaskMetric => ({
  id: "t1",
  vaId: "va-1",
  status: "todo",
  deadline: "2026-10-29",
  deadlineTime: null,
  deadlineTimezone: MANILA,
  doneAt: null,
  ...over,
});
const session = (taskId: string, startedAt: string, endedAt: string | null): WorkSession => ({ id: `${taskId}-${startedAt}`, taskId, startedAt, endedAt });

describe("weekly figures", () => {
  it("starts the trend on the Monday weeks back, in the zone", () => {
    expect(trendStart(MANILA, NOW, 1)).toBe("2026-10-25T16:00:00.000Z");
    expect(trendStart(MANILA, NOW, 3)).toBe("2026-10-11T16:00:00.000Z");
  });

  it("counts closed tasks, the on-time share and logged hours per Manila week, oldest first", () => {
    const tasks = [
      task({ id: "a", status: "done", deadline: "2026-10-27", doneAt: "2026-10-26T02:00:00+00:00" }),
      task({ id: "b", status: "done", deadline: "2026-10-20", doneAt: "2026-10-26T03:00:00+00:00" }),
      // Sunday 11 pm Manila: still last week.
      task({ id: "c", status: "done", deadline: "2026-10-25", doneAt: "2026-10-25T15:00:00.000Z" }),
      task({ id: "d", status: "in_progress" }),
    ];
    const sessions = [session("d", "2026-10-25T15:00:00.000Z", "2026-10-25T17:00:00.000Z"), session("d", "2026-10-29T05:00:00.000Z", null)];
    const weeks = weeklyFigures(tasks, sessions, MANILA, NOW, 3);
    expect(weeks.map((week) => week.monday)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeks.map((week) => week.done)).toEqual([0, 1, 2]);
    expect(weeks.map((week) => week.onTimeRate)).toEqual([null, 1, 0.5]);
    // The session across midnight Sunday is split between the weeks; the running one counts to now.
    expect(weeks.map((week) => week.ms)).toEqual([0, HOUR, 2 * HOUR]);
  });
});

describe("hours per client", () => {
  it("adds each task's sessions inside the window to its client", () => {
    const sessions = new Map([
      ["a", [session("a", "2026-10-26T01:00:00.000Z", "2026-10-26T03:30:00.000Z")]],
      ["b", [session("b", "2026-10-27T01:00:00.000Z", "2026-10-27T02:00:00.000Z"), session("b", "2026-10-01T01:00:00.000Z", "2026-10-01T09:00:00.000Z")]],
      ["c", [session("c", "2026-10-28T01:00:00.000Z", "2026-10-28T02:00:00.000Z")]],
    ]);
    const tasks = [
      { id: "a", clientId: "x" },
      { id: "b", clientId: "x" },
      { id: "c", clientId: "y" },
      { id: "d", clientId: "z" },
    ];
    const byClient = msByClient(tasks, sessions, "2026-10-25T16:00:00.000Z", "2026-11-01T16:00:00.000Z", NOW);
    expect(Object.fromEntries(byClient)).toEqual({ x: 3.5 * HOUR, y: HOUR });
    expect(hoursOf(byClient.get("x") ?? 0)).toBe(3.5);
  });

  it("calls a week on track, near the limit from 85% and at the limit from 100%", () => {
    expect(hoursStatus(8 * HOUR, 10)?.label).toBe("On track");
    expect(hoursStatus(8.5 * HOUR, 10)).toEqual({ label: "Near limit", tone: "warning" });
    expect(hoursStatus(10 * HOUR, 10)).toEqual({ label: "Limit reached", tone: "danger" });
    expect(hoursStatus(HOUR, null)).toBeNull();
    expect(hoursStatus(HOUR, 0)).toBeNull();
  });
});

describe("due today", () => {
  it("keeps open tasks that are overdue or due today in their zone, soonest first", () => {
    const tasks = [
      task({ id: "today", deadline: "2026-10-29", deadlineTime: "17:00" }),
      task({ id: "late", deadline: "2026-10-28" }),
      task({ id: "tomorrow", deadline: "2026-10-30" }),
      task({ id: "review", status: "review", deadline: "2026-10-29" }),
      task({ id: "closed", status: "done", deadline: "2026-10-29" }),
      // Still Oct 28 in Los Angeles, so this one is due tomorrow there.
      task({ id: "los-angeles", deadline: "2026-10-29", deadlineTimezone: "America/Los_Angeles" }),
    ];
    expect(dueToday(tasks, NOW).map((item) => item.id)).toEqual(["late", "today"]);
  });
});
