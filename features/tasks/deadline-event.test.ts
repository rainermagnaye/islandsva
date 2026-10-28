import { describe, expect, it } from "vitest";
import { deadlineEvent, deadlineEventId, taskIdFromEvent } from "./deadline-event";

const TASK = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Call the vendor",
  vaFirstName: "Maria",
  deadline: "2026-10-29",
  deadlineTime: "14:30",
  deadlineTimezone: "Asia/Manila",
  status: "todo" as const,
};

describe("deadlineEvent", () => {
  it("places a Manila deadline on the calendar at that wall clock", () => {
    expect(deadlineEvent(TASK, "Asia/Manila")).toEqual({
      id: deadlineEventId(TASK.id),
      title: "Call the vendor",
      start: "2026-10-29T14:30",
      end: "2026-10-29T15:00",
      tone: "coral",
      who: "Maria",
      done: false,
    });
  });

  it("uses the end of the day when there is no time, and marks a done task", () => {
    const event = deadlineEvent({ ...TASK, deadlineTime: null, status: "done" }, "Asia/Manila");
    expect(event.start).toBe("2026-10-29T23:30");
    expect(event.end).toBe("2026-10-30T00:00");
    expect(event.done).toBe(true);
  });

  it("reads the task id back from the calendar event", () => {
    expect(taskIdFromEvent(deadlineEventId(TASK.id))).toBe(TASK.id);
    expect(taskIdFromEvent(TASK.id)).toBeNull();
  });
});
