import { addDays, clockLabel, formatDate, instantInZone, minutesOf } from "@/components/ui/date-math";
import type { Task } from "./contract";
import { calendarDate, isOnTime, isOverdue, relativeDay, sortTasks } from "./metrics";

// Task figures for the client's dashboard and "My assistants" page. Pure, so it is tested without a database.

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

/** Each task with its deadline as an instant and whether it is late, for lists that mix tasks with meetings. */
export function datedTasks(tasks: readonly Task[], now: Date) {
  return tasks.map((task) => ({
    task,
    at: new Date(instantInZone(task.deadline, task.deadlineTime ?? "23:59", task.deadlineTimezone)).toISOString(),
    overdue: isOverdue(task, now),
  }));
}

export type DashboardFigures = {
  open: number;
  /** Open, not yet late, and due from today through six days ahead. */
  dueThisWeek: number;
  review: number;
  overdue: number;
  /** The task that has been late longest, for the Overdue card's caption. */
  latest: Task | null;
  closedThisMonth: number;
  /** Share of this month's closed tasks closed on time; null when none closed. */
  onTimeRate: number | null;
};

/** The client dashboard's four numbers. Months are counted in the client's zone, deadlines in each task's. */
export function dashboardFigures(tasks: readonly Task[], timeZone: string, now: Date): DashboardFigures {
  const month = calendarDate(now, timeZone).slice(0, 7);
  const open = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const late = sortTasks(tasks.filter((task) => isOverdue(task, now)));
  const closed = tasks.filter((task) => task.status === "done" && task.doneAt !== null && calendarDate(new Date(task.doneAt), timeZone).slice(0, 7) === month);
  const dueThisWeek = open.filter((task) => {
    if (isOverdue(task, now)) return false;
    const today = calendarDate(now, task.deadlineTimezone);
    return task.deadline >= today && task.deadline <= addDays(today, 6);
  });
  return {
    open: open.length,
    dueThisWeek: dueThisWeek.length,
    review: tasks.filter((task) => task.status === "review").length,
    overdue: late.length,
    latest: late[0] ?? null,
    closedThisMonth: closed.length,
    onTimeRate: closed.length === 0 ? null : closed.filter((task) => isOnTime(task) === true).length / closed.length,
  };
}

/**
 * The line under a task's title: "Due tomorrow, 2:30 pm", "Due Tue, Nov 3", "Due Oct 26 · 2 days ago" when
 * late, or "Closed Oct 27 · on time" once closed.
 */
export function taskLine(task: Task, timeZone: string, now: Date): string {
  if (task.status === "done") {
    if (!task.doneAt) return "Closed";
    const day = formatDate(calendarDate(new Date(task.doneAt), timeZone), { month: "short", day: "numeric" });
    const onTime = isOnTime(task);
    return onTime === null ? `Closed ${day}` : `Closed ${day} · ${onTime ? "on time" : "late"}`;
  }
  const time = task.deadlineTime ? `, ${clockLabel(minutesOf(task.deadlineTime))}` : "";
  const relative = relativeDay(task.deadline, task.deadlineTimezone, now);
  if (isOverdue(task, now)) return `Due ${formatDate(task.deadline, { month: "short", day: "numeric" })} · ${relative.toLowerCase()}`;
  if (relative === "Today" || relative === "Tomorrow") return `Due ${relative.toLowerCase()}${time}`;
  return `Due ${formatDate(task.deadline, { weekday: "short", month: "short", day: "numeric" })}${time}`;
}
