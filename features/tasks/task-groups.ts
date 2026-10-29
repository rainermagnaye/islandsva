import type { TaskStatus } from "./contract";

export const TASK_GROUPS = ["all", "pending", "unassigned", "completed"] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

export const TASK_GROUP_LABELS: Record<TaskGroup, string> = {
  all: "All",
  pending: "Pending",
  unassigned: "Unassigned",
  completed: "Completed",
};

/**
 * Pending is still open, including a task in review. Completed is closed. Unassigned is empty: a task is always created for one VA.
 */
export function tasksInGroup<T extends { status: TaskStatus }>(tasks: readonly T[], group: TaskGroup): T[] {
  if (group === "pending") return tasks.filter((task) => task.status !== "done");
  if (group === "completed") return tasks.filter((task) => task.status === "done");
  if (group === "unassigned") return [];
  return [...tasks];
}
