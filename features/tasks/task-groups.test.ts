import { describe, expect, it } from "vitest";
import { tasksInGroup } from "./task-groups";

const tasks = [
  { id: "a", status: "todo" as const },
  { id: "b", status: "in_progress" as const },
  { id: "c", status: "done" as const },
  { id: "d", status: "review" as const },
];

describe("tasksInGroup", () => {
  it("keeps open tasks as pending and done tasks as completed", () => {
    expect(tasksInGroup(tasks, "all").map((task) => task.id)).toEqual(["a", "b", "c", "d"]);
    expect(tasksInGroup(tasks, "pending").map((task) => task.id)).toEqual(["a", "b", "d"]);
    expect(tasksInGroup(tasks, "completed").map((task) => task.id)).toEqual(["c"]);
  });

  it("has no unassigned tasks, because each task belongs to a VA", () => {
    expect(tasksInGroup(tasks, "unassigned")).toEqual([]);
  });
});
