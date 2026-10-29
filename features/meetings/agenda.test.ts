import { describe, expect, it } from "vitest";
import { agenda, clientAgendaSources, vaAgendaSources, type AgendaSource } from "./agenda";
import type { Booking } from "./contract";

// Wed Oct 28, 2026, 4:34 pm in Manila.
const NOW = new Date("2026-10-28T08:34:00.000Z");
const ZONE = "Asia/Manila";

const source = (key: string, over: Partial<AgendaSource>): AgendaSource => ({
  key,
  kind: "deadline",
  title: key,
  at: "2026-10-29T06:30:00.000Z",
  end: null,
  who: "Lia",
  overdue: false,
  badge: null,
  href: null,
  bookingId: null,
  ...over,
});

describe("agenda", () => {
  const items = agenda(
    [
      source("later-this-week", { at: "2026-10-30T05:00:00.000Z", end: "2026-10-30T05:30:00.000Z", kind: "meeting" }),
      source("tomorrow", {}),
      source("late", { at: "2026-10-26T07:00:00.000Z", overdue: true, who: "Marco" }),
      source("past-meeting", { at: "2026-10-27T02:00:00.000Z", end: "2026-10-27T03:00:00.000Z", kind: "meeting" }),
      source("on-now", { at: "2026-10-28T08:00:00.000Z", end: "2026-10-28T09:00:00.000Z", kind: "meeting" }),
      source("too-far", { at: "2026-11-20T02:00:00.000Z" }),
    ],
    ZONE,
    NOW,
  );

  it("puts overdue first, then the next two weeks soonest first, and leaves out the past and the far future", () => {
    expect(items.map((item) => item.key)).toEqual(["late", "on-now", "tomorrow", "later-this-week"]);
  });

  it("labels each group by day in the client's zone", () => {
    expect(items.map((item) => item.group)).toEqual(["Overdue", "Today", "Tomorrow", "Fri, Oct 30"]);
  });

  it("writes the time line: a deadline with its VA, a meeting as a range, an overdue one with its date", () => {
    expect(items.map((item) => item.when)).toEqual(["Mon, Oct 26 · Due 3 pm · Marco", "4 pm–5 pm", "Due 2:30 pm · Lia", "1 pm–1:30 pm"]);
  });

  it("gives each item its day in the client's zone", () => {
    expect(items.map((item) => item.date)).toEqual(["2026-10-26", "2026-10-28", "2026-10-29", "2026-10-30"]);
  });
});

describe("clientAgendaSources", () => {
  const meeting = (id: string, status: Booking["status"]) =>
    ({ id, title: id, status, startsAt: "2026-10-30T02:00:00.000Z", endsAt: "2026-10-30T03:00:00.000Z", guests: [{ id: "va", kind: "staff", name: "Lia" }], staffName: "Lia" }) as Booking;

  it("keeps open tasks, meetings still on and demo calls still to come, with their badges", () => {
    const sources = clientAgendaSources({
      tasks: [
        { id: "open", title: "Open", vaFirstName: "Lia", at: "2026-10-29T06:30:00.000Z", status: "in_progress", overdue: false, href: "/t/open" },
        { id: "late", title: "Late", vaFirstName: "Marco", at: "2026-10-26T07:00:00.000Z", status: "todo", overdue: true, href: "/t/late" },
        { id: "closed", title: "Closed", vaFirstName: "Lia", at: "2026-10-20T07:00:00.000Z", status: "done", overdue: false, href: "/t/closed" },
      ],
      bookings: [meeting("on", "scheduled"), meeting("asked", "requested"), meeting("off", "cancelled"), meeting("held", "done")],
      demos: [
        { id: "d1", vaName: "Pia", startsAt: "2026-10-30T02:00:00.000Z", endsAt: "2026-10-30T02:30:00.000Z", state: "pending", href: "/match" },
        { id: "d2", vaName: "Omar", startsAt: "2026-10-20T02:00:00.000Z", endsAt: "2026-10-20T02:30:00.000Z", state: "completed", href: "/match" },
      ],
    });
    expect(sources.map((source) => [source.key, source.badge?.label ?? null])).toEqual([
      ["task:open", "In progress"],
      ["task:late", "Overdue"],
      ["meeting:on", null],
      ["meeting:asked", "Requested"],
      ["demo:d1", "Requested"],
    ]);
    expect(sources[2]).toMatchObject({ who: "Lia", bookingId: "on", href: null });
  });
});


describe("vaAgendaSources", () => {
  const meeting = (id: string, status: Booking["status"]) =>
    ({ id, title: id, status, startsAt: "2026-10-28T09:00:00.000Z", endsAt: "2026-10-28T09:30:00.000Z", clientName: "Harbor Legal", guests: [], staffName: "Lia" }) as unknown as Booking;

  it("keeps meetings still on and confirmed demo calls, but not requests waiting for an answer", () => {
    const sources = vaAgendaSources({
      bookings: [meeting("on", "scheduled"), meeting("asked", "requested"), meeting("off", "cancelled")],
      demos: [
        { id: "d1", status: "confirmed", companyName: "Kalye Coffee", startsAt: "2026-10-28T10:00:00.000Z", endsAt: "2026-10-28T10:30:00.000Z" },
        { id: "d2", status: "pending", companyName: "Coral Bay", startsAt: "2026-10-28T11:00:00.000Z", endsAt: "2026-10-28T11:30:00.000Z" },
      ],
    });
    expect(sources.map((source) => [source.key, source.badge?.label ?? null])).toEqual([
      ["meeting:on", null],
      ["meeting:asked", "Requested"],
      ["demo:d1", null],
    ]);
    expect(agenda(sources, ZONE, NOW, 1).map((item) => [item.title, item.group, item.when])).toEqual([
      ["asked", "Today", "5 pm–5:30 pm"],
      ["on", "Today", "5 pm–5:30 pm"],
      ["Demo call with Kalye Coffee", "Today", "6 pm–6:30 pm"],
    ]);
  });
});
