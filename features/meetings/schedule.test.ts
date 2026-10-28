import { describe, expect, it } from "vitest";
import type { Booking } from "./contract";
import { scheduleRows } from "./schedule";

const booking = (extra: Partial<Booking>) =>
  ({
    id: "m1",
    kind: "manual",
    title: "Weekly sync",
    status: "scheduled",
    startsAt: "2026-11-03T01:00:00.000Z",
    endsAt: "2026-11-03T02:00:00.000Z",
    guests: [{ id: "va", kind: "staff", name: "Tine" }, { id: "c", kind: "client", name: "Acme" }],
    staffName: "Tine",
    ...extra,
  }) as Booking;

describe("scheduleRows", () => {
  it("lists meetings, task deadlines and demo calls together, newest first", () => {
    const rows = scheduleRows({
      bookings: [booking({})],
      tasks: [{ id: "t1", title: "Inbox cleanup", vaFirstName: "Tine", at: "2026-11-05T09:00:00.000Z", status: "in_progress", overdue: false, href: "/client/tasks/t1" }],
      demos: [{ id: "d1", vaName: "Lia", startsAt: "2026-10-30T02:00:00.000Z", endsAt: "2026-10-30T02:30:00.000Z", state: "pending", href: "/client/match" }],
    });
    expect(rows.map((row) => [row.kind, row.title, row.who, row.status.label])).toEqual([
      ["task", "Inbox cleanup", "Tine", "In progress"],
      ["meeting", "Weekly sync", "Tine", "Scheduled"],
      ["demo", "Demo call with Lia", "Lia", "Requested"],
    ]);
    expect(rows[1]).toMatchObject({ bookingId: "m1", href: null, end: "2026-11-03T02:00:00.000Z" });
    expect(rows[0]).toMatchObject({ bookingId: null, href: "/client/tasks/t1", end: null });
  });

  it("marks an overdue task, and names the agency when no assistant is on a meeting", () => {
    const [task] = scheduleRows({ bookings: [], demos: [], tasks: [{ id: "t", title: "Late", vaFirstName: "Tine", at: "2026-10-01T00:00:00.000Z", status: "todo", overdue: true, href: "/t" }] });
    expect(task.status).toEqual({ label: "Overdue", tone: "danger" });
    const [meeting] = scheduleRows({ bookings: [booking({ guests: [], staffName: null, status: "cancelled" })], tasks: [], demos: [] });
    expect(meeting).toMatchObject({ who: "Islands VA", status: { label: "Cancelled", tone: "neutral" } });
  });
});
