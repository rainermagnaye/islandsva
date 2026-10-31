import { describe, expect, it } from "vitest";
import type { AssignedClient } from "@/features/clients/contract";
import type { Task } from "@/features/tasks/contract";
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

  it("counts open work and overdue, and carries the agreed hours", () => {
    const tasks = [
      task("late", "a", { deadline: "2026-10-27" }),
      task("open", "a"),
      task("done", "a", { status: "done", doneAt: "2026-10-28T00:00:00.000Z" }),
      task("b1", "b"),
    ];
    const [a, b] = clientRows([client("a"), client("b", { hoursPerWeek: null, timezone: null })], tasks, NOW);
    expect(a).toMatchObject({ open: 2, overdue: 1, hoursPerWeek: 20, attention: true, since: "Mar 2026" });
    expect(b).toMatchObject({ open: 1, overdue: 0, hoursPerWeek: null, time: null, attention: true });
  });

  it("needs attention when something is overdue or missing, and not when all is well", () => {
    const tasks = [task("t", "a")];
    expect(clientRows([client("a", { hoursPerWeek: null })], tasks, NOW)[0].attention).toBe(true);
    expect(clientRows([client("a")], [task("t", "a", { deadline: "2026-10-27" })], NOW)[0].attention).toBe(true);
    expect(clientRows([client("a")], tasks, NOW)[0].attention).toBe(false);
  });

  it("filters by search and view", () => {
    const rows = clientRows([client("a", { companyName: "Lumen Dental" }), client("b", { companyName: "Harbor Legal", timezone: "Australia/Sydney", contactName: "Mei Chen" })], [], NOW);
    expect(filterRows(rows, " mei ", "all").map((row) => row.id)).toEqual(["b"]);
    expect(filterRows(rows, "", "daytime").map((row) => row.id)).toEqual(["b"]);
    expect(filterRows(rows, "", "attention")).toEqual([]);
    expect([viewOf("attention"), viewOf("nope"), viewOf(undefined), viewOf(["daytime"])]).toEqual(["attention", "all", "all", "all"]);
  });
});
