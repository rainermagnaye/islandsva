import { describe, expect, it } from "vitest";
import type { AssignedClient } from "@/features/clients/contract";
import type { Task, WorkSession } from "@/features/tasks/contract";
import { cityOf, clientRows, filterRows, theirTime, viewOf } from "./client-rows";

// Thursday Oct 29, 2026, 1:00 pm in Manila.
const NOW = new Date("2026-10-29T05:00:00.000Z");

const client = (id: string, over: Partial<AssignedClient> = {}): AssignedClient => ({
  id,
  companyName: `Company ${id}`,
  contactName: `Contact ${id}`,
  contactEmail: `${id}@example.com`,
  timezone: "America/New_York",
  hoursPerWeek: 20,
  startedAt: "2026-03-02T00:00:00.000Z",
  ...over,
});

const task = (id: string, clientId: string, over: Partial<Task> = {}): Task => ({
  id,
  clientId,
  vaId: "va",
  title: id,
  description: null,
  severity: "medium",
  durationMinutes: 60,
  deadline: "2026-11-05",
  deadlineTime: null,
  deadlineTimezone: "Asia/Manila",
  companyName: "C",
  vaFirstName: "V",
  status: "in_progress",
  doneAt: null,
  startedAt: null,
  createdBy: "c",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  ...over,
});

const session = (taskId: string, startedAt: string, endedAt: string | null): WorkSession => ({ id: `${taskId}-${startedAt}`, taskId, startedAt, endedAt });

describe("client rows", () => {
  it("tells the client's time, whether it's day there, and the gap to Manila", () => {
    expect(theirTime("America/New_York", NOW)).toEqual({ clock: "1:00 am", city: "New York", day: false, line: "Night there · 12 h behind you" });
    expect(theirTime("Australia/Sydney", NOW)).toEqual({ clock: "4:00 pm", city: "Sydney", day: true, line: "Daytime there · 3 h ahead of you" });
    expect(theirTime("Asia/Kolkata", NOW)?.line).toBe("Daytime there · 2 h 30 min behind you");
    expect(theirTime("Asia/Manila", NOW)?.line).toBe("Daytime there · same time as you");
    expect(theirTime(null, NOW)).toBeNull();
    expect(theirTime("Not/AZone", NOW)).toBeNull();
    expect(cityOf("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });

  it("counts this week's hours in the client's week, open work, overdue and delayed", () => {
    const tasks = [
      task("late", "a", { deadline: "2026-10-27" }),
      task("over", "a", { durationMinutes: 30 }),
      task("done", "a", { status: "done", doneAt: "2026-10-28T00:00:00.000Z" }),
      task("b1", "b"),
    ];
    const sessions = new Map<string, WorkSession[]>([
      // New York's week began Monday Oct 26, 00:00 EDT (04:00 UTC): the Sunday session doesn't count.
      ["over", [session("over", "2026-10-25T20:00:00.000Z", "2026-10-25T21:00:00.000Z"), session("over", "2026-10-28T01:00:00.000Z", "2026-10-28T01:45:00.000Z")]],
      ["done", [session("done", "2026-10-27T01:00:00.000Z", "2026-10-27T02:30:00.000Z")]],
    ]);
    const [a, b] = clientRows([client("a"), client("b", { hoursPerWeek: null, timezone: null })], tasks, sessions, NOW);
    expect(a).toMatchObject({ open: 2, overdue: 1, delayed: 1, hours: { used: 2.3, agreed: 20 }, attention: true, since: "Mar 2026" });
    expect(b).toMatchObject({ open: 1, overdue: 0, delayed: 0, hours: null, time: null, attention: true });
  });

  it("needs attention near the week's limit, and not when all is well", () => {
    const sessions = new Map<string, WorkSession[]>([["t", [session("t", "2026-10-27T00:00:00.000Z", "2026-10-27T03:30:00.000Z")]]]);
    const tasks = [task("t", "a", { durationMinutes: 600 })];
    expect(clientRows([client("a", { hoursPerWeek: 4 })], tasks, sessions, NOW)[0].attention).toBe(true);
    expect(clientRows([client("a", { hoursPerWeek: 20 })], tasks, sessions, NOW)[0].attention).toBe(false);
  });

  it("filters by search and view", () => {
    const rows = clientRows([client("a", { companyName: "Lumen Dental" }), client("b", { companyName: "Harbor Legal", timezone: "Australia/Sydney", contactName: "Mei Chen" })], [], new Map(), NOW);
    expect(filterRows(rows, " mei ", "all").map((row) => row.id)).toEqual(["b"]);
    expect(filterRows(rows, "", "daytime").map((row) => row.id)).toEqual(["b"]);
    expect(filterRows(rows, "", "attention")).toEqual([]);
    expect([viewOf("attention"), viewOf("nope"), viewOf(undefined), viewOf(["daytime"])]).toEqual(["attention", "all", "all", "all"]);
  });
});
