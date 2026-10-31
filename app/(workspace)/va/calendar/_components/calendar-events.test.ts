import { describe, expect, it } from "vitest";
import { calendarExtras } from "./calendar-events";

const task = { id: "t1", title: "Inbox", vaFirstName: "Ana", deadline: "2026-11-02", deadlineTime: "17:00", deadlineTimezone: "Asia/Manila", status: "todo" as const };

describe("calendarExtras", () => {
  const extras = calendarExtras(
    {
      demos: [
        { id: "d1", status: "pending", startsAt: "2026-11-02T01:00:00.000Z", endsAt: "2026-11-02T01:30:00.000Z", companyName: "Acme" },
        { id: "d2", status: "confirmed", startsAt: "2026-11-03T01:00:00.000Z", endsAt: "2026-11-03T01:30:00.000Z", companyName: "Beta" },
      ],
      slots: [
        { id: "s1", startsAt: "2026-11-04T02:00:00.000Z", booking: null },
        { id: "s2", startsAt: "2026-11-02T01:00:00.000Z", booking: { status: "pending" } },
      ],
      tasks: [task, { ...task, id: "t2", status: "done" as const }],
    },
    "Asia/Manila",
    (id) => `/va/tasks/${id}`,
  );

  it("shows requests dashed and calls solid, in Manila time", () => {
    expect(extras[0].event).toMatchObject({ title: "Demo request · Acme", start: "2026-11-02T09:00", end: "2026-11-02T09:30", pending: true });
    expect(extras[1].event).toMatchObject({ title: "Demo call · Beta", pending: false });
  });

  it("shows only unbooked slots, as 30 minutes", () => {
    const slots = extras.filter((extra) => extra.event.id.startsWith("slot:"));
    expect(slots).toHaveLength(1);
    expect(slots[0].event).toMatchObject({ start: "2026-11-04T10:00", end: "2026-11-04T10:30", tone: "sand" });
  });

  it("shows open task deadlines with a link", () => {
    const due = extras.filter((extra) => extra.href);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ href: "/va/tasks/t1", event: { title: "Due: Inbox", start: "2026-11-02T17:00", tone: "coral" } });
  });
});

describe("calendarExtras blocks", () => {
  const extras = calendarExtras(
    {
      demos: [],
      slots: [],
      tasks: [],
      blocks: [
        { id: "b1", taskId: "t1", title: "Recall list", companyName: "Lumen", startsAt: "2026-11-02T02:30:00.000Z", endsAt: "2026-11-02T04:00:00.000Z" },
        { id: "b2", taskId: null, title: "Inbox zero", companyName: null, startsAt: "2026-11-02T05:00:00.000Z", endsAt: "2026-11-02T05:30:00.000Z" },
      ],
    },
    "Asia/Manila",
    (id) => `/va/tasks/${id}`,
  );

  it("links a task block to its task and keeps a to-do clickable by id", () => {
    expect(extras[0]).toMatchObject({ href: "/va/tasks/t1", event: { title: "Work: Recall list", start: "2026-11-02T10:30", end: "2026-11-02T12:00", who: "Lumen" } });
    expect(extras[1].href).toBeUndefined();
    expect(extras[1].event).toMatchObject({ id: "block:b2", title: "Inbox zero", who: "To-do" });
  });
});
