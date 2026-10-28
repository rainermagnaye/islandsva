import type { Task } from "./contract";
import { calendarDate, isOverdue, sortTasks } from "./metrics";

// Per-VA task figures for the client's "My assistants" page. Pure, so it is tested without a database.

export type VaWork = {
  /** With the VA: to do or in progress. */
  open: number;
  /** Submitted and waiting for the client. */
  review: number;
  /** Closed in the current calendar month of `timeZone`. */
  closedThisMonth: number;
  /** The open task due soonest, or null. */
  next: Task | null;
  nextOverdue: boolean;
};

export function vaWork(tasks: readonly Task[], vaId: string, timeZone: string, now: Date): VaWork {
  const theirs = tasks.filter((task) => task.vaId === vaId);
  const month = calendarDate(now, timeZone).slice(0, 7);
  const open = sortTasks(theirs.filter((task) => task.status === "todo" || task.status === "in_progress"));
  const next = open[0] ?? null;
  return {
    open: open.length,
    review: theirs.filter((task) => task.status === "review").length,
    closedThisMonth: theirs.filter((task) => task.status === "done" && task.doneAt !== null && calendarDate(new Date(task.doneAt), timeZone).slice(0, 7) === month).length,
    next,
    nextOverdue: next !== null && isOverdue(next, now),
  };
}

/** Tasks waiting for the client's review, the longest-waiting first. */
export function reviewQueue(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => task.status === "review").sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : a.id < b.id ? -1 : 1));
}
