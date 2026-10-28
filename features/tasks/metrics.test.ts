import { describe, expect, it } from "vitest";
import type { TaskMetric } from "./metrics";
import { acceptableDeadline, calendarDate, isOnTime, isOverdue, needsFeedback, nextStatuses, performance, performanceByVa, relativeDay, sortTasks } from "./metrics";

// 11:30 UTC on 26 Oct 2026 is still that calendar day in UTC, and 00:30 the next day in Auckland (NZDT, UTC+13).
const AUCKLAND = "Pacific/Auckland";
const INSTANT = new Date("2026-10-26T11:30:00.000Z");

const task = (over: Partial<TaskMetric> = {}): TaskMetric => ({
  id: "t1",
  vaId: "va-1",
  status: "todo",
  deadline: "2026-10-27",
  deadlineTime: null,
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

  it("treats a time earlier today as overdue and a later time as still open", () => {
    expect(isOverdue(task({ deadlineTime: "00:00" }), INSTANT)).toBe(true);
    expect(isOverdue(task({ deadlineTime: "01:00" }), INSTANT)).toBe(false);
    const late = task({ status: "done", deadlineTime: "00:00", doneAt: INSTANT.toISOString() });
    expect(isOnTime(late)).toBe(false);
    const onTime = task({ status: "done", deadlineTime: "01:00", doneAt: INSTANT.toISOString() });
    expect(isOnTime(onTime)).toBe(true);
  });

  it("accepts a future moment and refuses a day outside the window or a time already passed", () => {
    expect(acceptableDeadline("2026-10-27", "01:00", AUCKLAND, INSTANT)).toBe("ok");
    expect(acceptableDeadline("2026-10-27", "00:00", AUCKLAND, INSTANT)).toBe("time");
    expect(acceptableDeadline("2026-10-26", "23:00", AUCKLAND, INSTANT)).toBe("date");
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
  it("lets the VA start and submit, and never close", () => {
    expect(nextStatuses("todo", "va")).toEqual(["in_progress", "review"]);
    expect(nextStatuses("in_progress", "va")).toEqual(["review"]);
    expect(nextStatuses("review", "va")).toEqual([]);
    expect(nextStatuses("done", "va")).toEqual([]);
  });

  it("lets the client decide a review, close an open task, and reopen a closed one", () => {
    expect(nextStatuses("todo", "client")).toEqual(["done"]);
    expect(nextStatuses("in_progress", "client")).toEqual(["done"]);
    expect(nextStatuses("review", "client")).toEqual(["done", "in_progress"]);
    expect(nextStatuses("done", "client")).toEqual(["in_progress"]);
  });

  it("asks for feedback only when work goes back to the VA", () => {
    expect(needsFeedback("review", "in_progress")).toBe(true);
    expect(needsFeedback("done", "in_progress")).toBe(true);
    expect(needsFeedback("todo", "in_progress")).toBe(false);
    expect(needsFeedback("review", "done")).toBe(false);
  });
});

describe("review and relative days", () => {
  it("does not count a task in review as overdue", () => {
    expect(isOverdue(task({ deadline: "2026-10-01", status: "review" }), INSTANT)).toBe(false);
    expect(isOverdue(task({ deadline: "2026-10-01", status: "in_progress" }), INSTANT)).toBe(true);
  });

  it("names the deadline's day against today in that zone", () => {
    // INSTANT is 27 Oct in Auckland and 26 Oct in UTC.
    expect(relativeDay("2026-10-27", AUCKLAND, INSTANT)).toBe("Today");
    expect(relativeDay("2026-10-27", "UTC", INSTANT)).toBe("Tomorrow");
    expect(relativeDay("2026-10-30", AUCKLAND, INSTANT)).toBe("In 3 days");
    expect(relativeDay("2026-10-26", AUCKLAND, INSTANT)).toBe("Yesterday");
    expect(relativeDay("2026-10-24", AUCKLAND, INSTANT)).toBe("3 days ago");
  });
});
