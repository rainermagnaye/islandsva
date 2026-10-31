import { describe, expect, it } from "vitest";
import type { TaskMetric } from "./metrics";
import { dueToday, weeklyFigures } from "./weekly";

// Thu Oct 29, 2026, 2:00 pm in Manila. That week starts Mon Oct 26, 00:00 Manila.
const NOW = new Date("2026-10-29T06:00:00.000Z");
const MANILA = "Asia/Manila";

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

describe("weekly figures", () => {
  it("counts closed tasks and the on-time share per Manila week, oldest first", () => {
    const tasks = [
      task({ id: "a", status: "done", deadline: "2026-10-27", doneAt: "2026-10-26T02:00:00+00:00" }),
      task({ id: "b", status: "done", deadline: "2026-10-20", doneAt: "2026-10-26T03:00:00+00:00" }),
      // Sunday 11 pm Manila: still last week.
      task({ id: "c", status: "done", deadline: "2026-10-25", doneAt: "2026-10-25T15:00:00.000Z" }),
      task({ id: "d", status: "in_progress" }),
    ];
    const weeks = weeklyFigures(tasks, MANILA, NOW, 3);
    expect(weeks.map((week) => week.monday)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeks.map((week) => week.done)).toEqual([0, 1, 2]);
    expect(weeks.map((week) => week.onTimeRate)).toEqual([null, 1, 0.5]);
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
