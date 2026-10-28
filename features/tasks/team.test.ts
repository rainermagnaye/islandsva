import { describe, expect, it } from "vitest";
import type { Task } from "./contract";
import { reviewQueue, vaWork } from "./team";

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
