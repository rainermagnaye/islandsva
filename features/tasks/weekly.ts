import { addDays, instantInZone } from "@/components/ui/date-math";
import type { WorkSession } from "./contract";
import { calendarDate, isOnTime, isOverdue, sortTasks, type TaskMetric } from "./metrics";
import { msBetween, packageWeek } from "./time";

// The VA dashboard's week-by-week figures: tasks closed, on-time share and hours logged, plus each client's hours
// against their agreed weekly hours. Computed from tasks and work sessions; nothing here is stored.

const HOUR = 3_600_000;

export type WeekFigure = {
  /** The week's Monday, YYYY-MM-DD in the zone. */
  monday: string;
  done: number;
  /** Null when nothing closed that week — the screen never shows 0%. */
  onTimeRate: number | null;
  /** Work logged that week, in milliseconds. */
  ms: number;
};

/** Monday 00:00 of the week `weeks - 1` weeks back, as a UTC instant: how far back the trend reads sessions. */
export function trendStart(timeZone: string, now: Date, weeks: number): string {
  return instantInZone(addDays(packageWeek(timeZone, now).monday, -(weeks - 1) * 7), "00:00", timeZone);
}

/** The last `weeks` weeks (Monday to Monday in `timeZone`), oldest first; the last one is this week. */
export function weeklyFigures(tasks: readonly TaskMetric[], sessions: readonly WorkSession[], timeZone: string, now: Date, weeks: number): WeekFigure[] {
  const thisMonday = packageWeek(timeZone, now).monday;
  return Array.from({ length: weeks }, (_, index) => {
    const monday = addDays(thisMonday, (index - weeks + 1) * 7);
    const start = instantInZone(monday, "00:00", timeZone);
    const end = instantInZone(addDays(monday, 7), "00:00", timeZone);
    // Parsed, not compared as text: the database writes "+00:00" offsets, instantInZone writes "Z".
    const done = tasks.filter((task) => task.status === "done" && task.doneAt !== null && Date.parse(task.doneAt) >= Date.parse(start) && Date.parse(task.doneAt) < Date.parse(end));
    const onTime = done.filter((task) => isOnTime(task) === true).length;
    return { monday, done: done.length, onTimeRate: done.length === 0 ? null : onTime / done.length, ms: msBetween(sessions, start, end, now) };
  });
}

/** Milliseconds logged per client between `start` and `end`, through each task's client. */
export function msByClient(
  tasks: readonly { id: string; clientId: string }[],
  sessions: ReadonlyMap<string, readonly WorkSession[]>,
  start: string,
  end: string,
  now: Date,
): Map<string, number> {
  const byClient = new Map<string, number>();
  for (const task of tasks) {
    const ms = msBetween(sessions.get(task.id) ?? [], start, end, now);
    if (ms > 0) byClient.set(task.clientId, (byClient.get(task.clientId) ?? 0) + ms);
  }
  return byClient;
}

export type HoursStatus = { label: string; tone: "success" | "warning" | "danger" };

/** A client's week against their agreed hours. Same thresholds as ProgressBar: warning from 85%, danger at 100%. */
export function hoursStatus(ms: number, agreedHours: number | null): HoursStatus | null {
  if (!agreedHours || agreedHours <= 0) return null;
  const share = ms / (agreedHours * HOUR);
  if (share >= 1) return { label: "Limit reached", tone: "danger" };
  if (share >= 0.85) return { label: "Near limit", tone: "warning" };
  return { label: "On track", tone: "success" };
}

/** Hours with at most one decimal, as a number: 9.5, 14, 0. */
export const hoursOf = (ms: number) => Math.round((ms / HOUR) * 10) / 10;

/** Open work that needs the VA today: overdue, or due today in the task's own zone. Soonest first. */
export function dueToday<T extends TaskMetric>(tasks: readonly T[], now: Date): T[] {
  return sortTasks(tasks.filter((task) => (task.status === "todo" || task.status === "in_progress") && (isOverdue(task, now) || task.deadline === calendarDate(now, task.deadlineTimezone))));
}
