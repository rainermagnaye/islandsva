import { describe, expect, it } from "vitest";
import { filterTasks, taskFilterOf } from "./task-filter";

const NOW = new Date("2026-10-30T10:00:00.000Z");
const task = (id: string, over: Partial<{ title: string; companyName: string; status: "todo" | "in_progress" | "review" | "done"; deadline: string }> = {}) => ({
  id,
  title: `Task ${id}`,
  companyName: "Lumen Dental",
  status: "todo" as const,
  deadline: "2026-11-05",
  deadlineTime: null,
  deadlineTimezone: "Asia/Manila",
  ...over,
});

describe("VA task filter", () => {
  const tasks = [
    task("a", { title: "Send the recall list", status: "in_progress", deadline: "2026-10-28" }),
    task("b", { companyName: "Harbor Legal", status: "review" }),
    task("c", { status: "done", deadline: "2026-10-20" }),
  ];

  it("reads only known filters from the URL", () => {
    expect([taskFilterOf("review"), taskFilterOf("delayed"), taskFilterOf("nope"), taskFilterOf(undefined), taskFilterOf(["todo"])]).toEqual(["review", undefined, undefined, undefined, undefined]);
  });

  it("filters by status and overdue, and searches title and company", () => {
    const ids = (q: string, f?: Parameters<typeof filterTasks>[2]) => filterTasks(tasks, q, f, NOW).map((t) => t.id);
    expect(ids("")).toEqual(["a", "b", "c"]);
    expect(ids("", "review")).toEqual(["b"]);
    expect(ids("", "overdue")).toEqual(["a"]);
    expect(ids(" RECALL ")).toEqual(["a"]);
    expect(ids("harbor")).toEqual(["b"]);
    expect(ids("harbor", "done")).toEqual([]);
  });
});
