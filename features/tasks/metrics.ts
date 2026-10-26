import { addDays, todayIn } from "@/components/ui/date-math";
import { TASK_LIMITS, type TaskStatus } from "./contract";

// On-time and overdue are computed from the deadline and the snapshotted zone. Nothing here is stored.

export type TaskMetric = {
  id: string;
  vaId: string;
  status: TaskStatus;
  deadline: string;
  deadlineTimezone: string;
  doneAt: string | null;
};

export type TaskFigures = {
  done: number;
  /** Null when nothing is done — the screen shows an em dash, never 0%. */
  onTimeRate: number | null;
  overdue: number;
};

/** The calendar date of an instant in an IANA zone, as YYYY-MM-DD. */
export function calendarDate(instant: Date, timeZone: string): string {
  return todayIn(timeZone, instant);
}

/**
 * Today through `deadlineDays` ahead in a zone, for the date picker. A zone Intl does not know
 * returns null so the form stays hidden; the database still rejects it.
 */
export function deadlineWindow(timeZone: string, now = new Date()): { today: string; last: string } | null {
  try {
    const today = calendarDate(now, timeZone);
    return { today, last: addDays(today, TASK_LIMITS.deadlineDays) };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** Not done, and today in the snapshot zone is after the deadline. Due today is not overdue. */
export function isOverdue(task: Pick<TaskMetric, "status" | "deadline" | "deadlineTimezone">, now: Date): boolean {
  if (task.status === "done") return false;
  return calendarDate(now, task.deadlineTimezone) > task.deadline;
}

/**
 * A done task is on time when its done_at calendar date in the snapshot zone is on or before the
 * deadline. A late completion is not overdue. Open tasks are neither.
 */
export function isOnTime(task: Pick<TaskMetric, "status" | "deadline" | "deadlineTimezone" | "doneAt">): boolean | null {
  if (task.status !== "done" || task.doneAt === null) return null;
  return calendarDate(new Date(task.doneAt), task.deadlineTimezone) <= task.deadline;
}

/** Tasks done, the on-time share of those, and how many are overdue. `now` is explicit so tests can pin the day. */
export function performance(tasks: readonly TaskMetric[], now: Date): TaskFigures {
  const done = tasks.filter((task) => task.status === "done");
  const onTime = done.filter((task) => isOnTime(task) === true).length;
  return {
    done: done.length,
    onTimeRate: done.length === 0 ? null : onTime / done.length,
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
  };
}

/** The same figures for each VA in the list, ordered by id. */
export function performanceByVa(tasks: readonly TaskMetric[], now: Date): ({ vaId: string } & TaskFigures)[] {
  const ids = [...new Set(tasks.map((task) => task.vaId))].sort();
  return ids.map((vaId) => ({ vaId, ...performance(tasks.filter((task) => task.vaId === vaId), now) }));
}

/** Open tasks first, then by deadline, then by id. Done tasks stay in the list. */
export function sortTasks<T extends Pick<TaskMetric, "id" | "status" | "deadline">>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const openFirst = Number(a.status === "done") - Number(b.status === "done");
    if (openFirst !== 0) return openFirst;
    if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/** Forward only. The client may close; the VA may also start the task. Nobody reopens. */
export function nextStatuses(status: TaskStatus, actor: "client" | "va"): TaskStatus[] {
  if (status === "done") return [];
  if (actor === "client") return ["done"];
  return status === "todo" ? ["in_progress", "done"] : ["done"];
}
