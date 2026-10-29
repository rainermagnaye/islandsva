import { addDays, instantInZone, minutesOf, todayIn } from "@/components/ui/date-math";
import { TASK_FALLBACK_TIMEZONE, TASK_LIMITS, type TaskStatus } from "./contract";

// On-time and overdue are computed from the deadline and the snapshotted zone. Nothing here is stored.

export type TaskMetric = {
  id: string;
  vaId: string;
  status: TaskStatus;
  deadline: string;
  /** "HH:MM" in the snapshot zone. Null means the end of that day. */
  deadlineTime: string | null;
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

/** The company's zone, or Philippine time when the company has none. */
export const taskTimeZone = (timeZone: string | null | undefined) => timeZone || TASK_FALLBACK_TIMEZONE;

/** "date" is outside today through the next year. "time" is a moment that has already passed. */
export function acceptableDeadline(date: string, time: string, timeZone: string, now = new Date()): "ok" | "date" | "time" {
  const window = deadlineWindow(timeZone, now);
  if (!window || date < window.today || date > window.last) return "date";
  try {
    const instant = new Date(instantInZone(date, time, timeZone));
    if (Number.isNaN(instant.getTime()) || instant.getTime() <= now.getTime()) return "time";
  } catch (error) {
    if (error instanceof RangeError) return "date";
    throw error;
  }
  return "ok";
}

function minutesNow(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return part("hour") * 60 + part("minute");
}

/**
 * Still with the VA, and the snapshot zone is past the deadline. A day with no time is overdue only after that
 * day. A task in review is waiting on the client, so it is not overdue.
 */
export function isOverdue(task: Pick<TaskMetric, "status" | "deadline" | "deadlineTime" | "deadlineTimezone">, now: Date): boolean {
  if (task.status === "done" || task.status === "review") return false;
  const today = calendarDate(now, task.deadlineTimezone);
  if (today > task.deadline) return true;
  if (today < task.deadline || !task.deadlineTime) return false;
  return minutesNow(now, task.deadlineTimezone) > minutesOf(task.deadlineTime);
}

/**
 * A done task is on time when its done_at calendar date in the snapshot zone is on or before the
 * deadline. A late completion is not overdue. Open tasks are neither.
 */
export function isOnTime(task: Pick<TaskMetric, "status" | "deadline" | "deadlineTime" | "deadlineTimezone" | "doneAt">): boolean | null {
  if (task.status !== "done" || task.doneAt === null) return null;
  const doneAt = new Date(task.doneAt);
  const doneDay = calendarDate(doneAt, task.deadlineTimezone);
  if (!task.deadlineTime) return doneDay <= task.deadline;
  if (doneDay !== task.deadline) return doneDay < task.deadline;
  return minutesNow(doneAt, task.deadlineTimezone) <= minutesOf(task.deadlineTime);
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
export function sortTasks<T extends Pick<TaskMetric, "id" | "status" | "deadline" | "deadlineTime">>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const openFirst = Number(a.status === "done") - Number(b.status === "done");
    if (openFirst !== 0) return openFirst;
    if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    const timeA = a.deadlineTime ?? "99:99";
    const timeB = b.deadlineTime ?? "99:99";
    if (timeA !== timeB) return timeA < timeB ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * The moves the database allows each side (guard_task). The VA starts and submits for review. The client
 * approves a review or sends it back (in_progress, with feedback), closes an open task without review, and
 * reopens a closed one (with feedback). Nobody goes back to to-do.
 */
export function nextStatuses(status: TaskStatus, actor: "client" | "va"): TaskStatus[] {
  if (actor === "va") {
    if (status === "todo") return ["in_progress", "review"];
    return status === "in_progress" ? ["review"] : [];
  }
  if (status === "review") return ["done", "in_progress"];
  return status === "done" ? ["in_progress"] : ["done"];
}

/** Whether a client move hands the task back to the VA, which needs written feedback. */
export const needsFeedback = (from: TaskStatus, to: TaskStatus) => to === "in_progress" && (from === "review" || from === "done");

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "2 days ago": the deadline's day against today in that zone. */
export function relativeDay(deadline: string, timeZone: string, now = new Date()): string {
  const today = calendarDate(now, timeZone);
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}
