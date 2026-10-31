import { TASK_STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from "@/features/tasks/contract";
import { isOverdue } from "@/features/tasks/metrics";

// The VA's task list filter: a status, or the two warnings. Kept in the URL (?show=), so it's shareable.

export type TaskFilter = TaskStatus | "overdue" | "delayed";

export const TASK_FILTER_OPTIONS: readonly { value: TaskFilter; label: string }[] = [
  ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
  { value: "overdue", label: "Overdue" },
  { value: "delayed", label: "Delayed" },
];

/** The URL's ?show=, or undefined (all tasks). */
export function taskFilterOf(value: string | string[] | undefined): TaskFilter | undefined {
  return TASK_FILTER_OPTIONS.find((option) => option.value === value)?.value;
}

/** Tasks matching the search (title or company, any case) and the filter. */
export function filterTasks<T extends Pick<Task, "id" | "title" | "companyName" | "status" | "deadline" | "deadlineTime" | "deadlineTimezone">>(
  tasks: readonly T[],
  query: string,
  filter: TaskFilter | undefined,
  delayed: ReadonlySet<string>,
  now: Date,
): T[] {
  const q = query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (q && !task.title.toLowerCase().includes(q) && !task.companyName.toLowerCase().includes(q)) return false;
    if (filter === "overdue") return isOverdue(task, now);
    if (filter === "delayed") return delayed.has(task.id);
    return filter === undefined || task.status === filter;
  });
}
