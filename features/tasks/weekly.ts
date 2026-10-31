import { addDays, instantInZone, startOfWeek, todayIn } from "@/components/ui/date-math";
import { calendarDate, isOnTime, isOverdue, sortTasks, type TaskMetric } from "./metrics";

// The VA dashboard's week-by-week figures: tasks closed and the on-time share. Computed from tasks; nothing here
// is stored.

export type WeekFigure = {
  /** The week's Monday, YYYY-MM-DD in the zone. */
  monday: string;
  done: number;
  /** Null when nothing closed that week — the screen never shows 0%. */
  onTimeRate: number | null;
};

/** The last `weeks` weeks (Monday to Monday in `timeZone`), oldest first; the last one is this week. */
export function weeklyFigures(tasks: readonly TaskMetric[], timeZone: string, now: Date, weeks: number): WeekFigure[] {
  const thisMonday = startOfWeek(todayIn(timeZone, now), 1);
  return Array.from({ length: weeks }, (_, index) => {
    const monday = addDays(thisMonday, (index - weeks + 1) * 7);
    const start = instantInZone(monday, "00:00", timeZone);
    const end = instantInZone(addDays(monday, 7), "00:00", timeZone);
    // Parsed, not compared as text: the database writes "+00:00" offsets, instantInZone writes "Z".
    const done = tasks.filter((task) => task.status === "done" && task.doneAt !== null && Date.parse(task.doneAt) >= Date.parse(start) && Date.parse(task.doneAt) < Date.parse(end));
    const onTime = done.filter((task) => isOnTime(task) === true).length;
    return { monday, done: done.length, onTimeRate: done.length === 0 ? null : onTime / done.length };
  });
}

/** Open work that needs the VA today: overdue, or due today in the task's own zone. Soonest first. */
export function dueToday<T extends TaskMetric>(tasks: readonly T[], now: Date): T[] {
  return sortTasks(tasks.filter((task) => (task.status === "todo" || task.status === "in_progress") && (isOverdue(task, now) || task.deadline === calendarDate(now, task.deadlineTimezone))));
}
