import { describe, expect, it } from "vitest";
import type { Task } from "./contract";
import { dashboardFigures, datedTasks, reviewQueue, taskLine, vaWork } from "./team";

const NOW = new Date("2026-10-28T03:00:00.000Z");
const ZONE = "Asia/Manila";

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  clientId: "c1",
  vaId: "va-1",
  title: id,
  description: null,
  severity: "medium",
  deadline: "2026-11-05",
  deadlineTime: null,
  deadlineTimezone: ZONE,
  companyName: "Test Company",
  vaFirstName: "Lia",
  status: "todo",
  doneAt: null,
  startedAt: null,
  createdBy: "client-1",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  ...over,
});

describe("vaWork", () => {
  const tasks = [
    task("later", { deadline: "2026-11-10" }),
    task("late", { deadline: "2026-10-20", status: "in_progress" }),
    task("waiting", { status: "review" }),
    task("closed-now", { status: "done", doneAt: "2026-10-27T10:00:00.000Z" }),
    // 30 Sep 23:30 in Manila is still September there.
    task("closed-before", { status: "done", doneAt: "2026-09-30T15:30:00.000Z" }),
    task("someone-else", { vaId: "va-2", deadline: "2026-10-01" }),
  ];

  it("counts open, in review and closed this month for one VA", () => {
    const work = vaWork(tasks, "va-1", ZONE, NOW);
    expect([work.open, work.review, work.closedThisMonth]).toEqual([2, 1, 1]);
  });

  it("names the open task due soonest, and whether it is late", () => {
    const work = vaWork(tasks, "va-1", ZONE, NOW);
    expect(work.next?.id).toBe("late");
    expect(work.nextOverdue).toBe(true);
  });

  it("has nothing next when the VA has no open task", () => {
    expect(vaWork([task("w", { status: "review" })], "va-1", ZONE, NOW)).toMatchObject({ open: 0, review: 1, next: null, nextOverdue: false });
  });
});

describe("reviewQueue", () => {
  it("lists only tasks in review, the longest-waiting first", () => {
    const queue = reviewQueue([
      task("b", { status: "review", updatedAt: "2026-10-27T00:00:00.000Z" }),
      task("x", { status: "in_progress" }),
      task("a", { status: "review", updatedAt: "2026-10-26T00:00:00.000Z" }),
    ]);
    expect(queue.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("dashboardFigures", () => {
  // Wed Oct 28, 11 am in Manila.
  const tasks = [
    task("this-week", { deadline: "2026-11-02" }),
    task("next-week", { deadline: "2026-11-04", status: "in_progress" }),
    task("late", { deadline: "2026-10-26", vaFirstName: "Marco" }),
    task("later", { deadline: "2026-10-27", vaFirstName: "Ana" }),
    task("review", { status: "review", deadline: "2026-10-20" }),
    task("on-time", { status: "done", deadline: "2026-10-27", doneAt: "2026-10-26T04:00:00.000Z" }),
    task("late-close", { status: "done", deadline: "2026-10-20", doneAt: "2026-10-22T04:00:00.000Z" }),
    task("last-month", { status: "done", deadline: "2026-09-29", doneAt: "2026-09-28T04:00:00.000Z" }),
  ];

  it("counts open, due this week, waiting for review, late and closed this month", () => {
    const figures = dashboardFigures(tasks, ZONE, NOW);
    expect(figures).toMatchObject({ open: 4, dueThisWeek: 1, review: 1, overdue: 2, closedThisMonth: 2, onTimeRate: 0.5 });
    expect(figures.latest?.id).toBe("late");
  });

  it("has no on-time rate and nothing late with no tasks", () => {
    expect(dashboardFigures([], ZONE, NOW)).toEqual({ open: 0, dueThisWeek: 0, review: 0, overdue: 0, latest: null, closedThisMonth: 0, onTimeRate: null });
  });
});

describe("taskLine", () => {
  it.each([
    [task("t", { deadline: "2026-10-29", deadlineTime: "14:30" }), "Due tomorrow, 2:30 pm"],
    [task("t", { deadline: "2026-10-28", deadlineTime: "17:00" }), "Due today, 5 pm"],
    [task("t", { deadline: "2026-11-03" }), "Due Tue, Nov 3"],
    [task("t", { deadline: "2026-10-26" }), "Due Oct 26 · 2 days ago"],
    [task("t", { status: "done", deadline: "2026-10-27", doneAt: "2026-10-26T04:00:00.000Z" }), "Closed Oct 26 · on time"],
    [task("t", { status: "done", deadline: "2026-10-20", doneAt: "2026-10-22T04:00:00.000Z" }), "Closed Oct 22 · late"],
  ])("describes %#", (item, line) => {
    expect(taskLine(item, ZONE, NOW)).toBe(line);
  });
});

describe("datedTasks", () => {
  it("gives each deadline as an instant, the end of the day when it has no time", () => {
    const [timed, allDay] = datedTasks([task("a", { deadline: "2026-10-29", deadlineTime: "14:30" }), task("b", { deadline: "2026-10-26" })], NOW);
    expect(timed).toMatchObject({ at: "2026-10-29T06:30:00.000Z", overdue: false });
    expect(allDay).toMatchObject({ at: "2026-10-26T15:59:00.000Z", overdue: true });
  });
});
