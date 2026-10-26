import { describe, expect, it } from "vitest";
import type { TaskMetric } from "./metrics";
import { calendarDate, isOnTime, isOverdue, nextStatuses, performance, performanceByVa, sortTasks } from "./metrics";

// 11:30 UTC on 26 Oct 2026 is still that calendar day in UTC, and 00:30 the next day in Auckland (NZDT, UTC+13).
const AUCKLAND = "Pacific/Auckland";
const INSTANT = new Date("2026-10-26T11:30:00.000Z");

const task = (over: Partial<TaskMetric> = {}): TaskMetric => ({
  id: "t1",
  vaId: "va-1",
  status: "todo",
  deadline: "2026-10-27",
  deadlineTimezone: AUCKLAND,
  doneAt: null,
  ...over,
});

describe("calendar dates in the snapshot zone", () => {
  it("reads an instant as the previous UTC day and the deadline day in Auckland", () => {
    expect(calendarDate(INSTANT, "UTC")).toBe("2026-10-26");
    expect(calendarDate(INSTANT, AUCKLAND)).toBe("2026-10-27");
    expect(isOverdue(task({ deadline: "2026-10-27" }), INSTANT)).toBe(false);
  });

  it("does not treat due today as overdue, and does treat the day after as overdue", () => {
    expect(isOverdue(task({ deadline: "2026-10-27" }), INSTANT)).toBe(false);
    // The UTC calendar day is still the deadline, so a UTC comparison would miss this.
    expect(isOverdue(task({ deadline: "2026-10-26" }), INSTANT)).toBe(true);
  });

  it("counts a late completion against on-time and not as overdue", () => {
    const late = task({ status: "done", deadline: "2026-10-26", doneAt: "2026-10-26T11:30:00.000Z" });
    expect(isOverdue(late, INSTANT)).toBe(false);
    expect(isOnTime(late)).toBe(false);
    const onTime = task({ status: "done", deadline: "2026-10-27", doneAt: "2026-10-26T11:30:00.000Z" });
    expect(isOnTime(onTime)).toBe(true);
  });
});

describe("performance", () => {
  it("has no rate when nothing is done, including when something is overdue", () => {
    expect(performance([], INSTANT).onTimeRate).toBeNull();
    const figures = performance([task({ deadline: "2026-10-26" })], INSTANT);
    expect(figures).toEqual({ done: 0, onTimeRate: null, overdue: 1 });
  });

  it("divides on-time completions by tasks done", () => {
    const figures = performance(
      [
        task({ id: "late", status: "done", deadline: "2026-10-26", doneAt: INSTANT.toISOString() }),
        task({ id: "ok", status: "done", deadline: "2026-10-27", doneAt: INSTANT.toISOString() }),
      ],
      INSTANT,
    );
    expect(figures.done).toBe(2);
    expect(figures.onTimeRate).toBe(0.5);
    expect(figures.overdue).toBe(0);
  });

  it("splits figures by VA", () => {
    const rows = performanceByVa(
      [
        task({ id: "a", vaId: "va-b", status: "done", deadline: "2026-10-27", doneAt: INSTANT.toISOString() }),
        task({ id: "b", vaId: "va-a", deadline: "2026-10-26" }),
      ],
      INSTANT,
    );
    expect(rows.map((row) => row.vaId)).toEqual(["va-a", "va-b"]);
    expect(rows[0]).toMatchObject({ done: 0, onTimeRate: null, overdue: 1 });
    expect(rows[1]).toMatchObject({ done: 1, onTimeRate: 1, overdue: 0 });
  });
});

describe("sortTasks", () => {
  it("lists open tasks before done ones, then by deadline", () => {
    const doneEarly = task({ id: "done-early", status: "done", deadline: "2026-01-01", doneAt: INSTANT.toISOString() });
    const openLater = task({ id: "open-later", status: "in_progress", deadline: "2026-12-01" });
    const openSooner = task({ id: "open-sooner", status: "todo", deadline: "2026-11-01" });
    expect(sortTasks([doneEarly, openLater, openSooner]).map((row) => row.id)).toEqual(["open-sooner", "open-later", "done-early"]);
  });
});

describe("nextStatuses", () => {
  it("lets the client only close, and the VA move forward", () => {
    expect(nextStatuses("todo", "client")).toEqual(["done"]);
    expect(nextStatuses("in_progress", "client")).toEqual(["done"]);
    expect(nextStatuses("todo", "va")).toEqual(["in_progress", "done"]);
    expect(nextStatuses("in_progress", "va")).toEqual(["done"]);
    expect(nextStatuses("done", "va")).toEqual([]);
    expect(nextStatuses("done", "client")).toEqual([]);
  });
});
