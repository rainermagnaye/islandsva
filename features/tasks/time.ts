import { addDays, instantInZone, startOfWeek, todayIn } from "@/components/ui/date-math";
import { TASK_DURATION, type TaskSeverity, type WorkSession } from "./contract";

// The VA's time on a task, from its work sessions. Nothing here is stored: the database keeps only the sessions
// (with its own clock), and these rules add them up for the screens.

const MINUTE = 60_000;

/** The starting duration for a severity, in minutes. */
export const defaultDuration = (severity: TaskSeverity) => TASK_DURATION.defaults[severity];

/** The running session, if the VA's timer is on. */
export const runningSession = (sessions: readonly WorkSession[]) => sessions.find((session) => session.endedAt === null) ?? null;

/** Milliseconds worked across the sessions. A running session counts up to `now`. */
export function workedMs(sessions: readonly WorkSession[], now: Date): number {
  return sessions.reduce((sum, session) => {
    const start = Date.parse(session.startedAt);
    const end = session.endedAt === null ? now.getTime() : Date.parse(session.endedAt);
    return sum + Math.max(0, end - start);
  }, 0);
}

/** Time left of the duration, in milliseconds. Negative once the work runs over. */
export const remainingMs = (durationMinutes: number, sessions: readonly WorkSession[], now: Date) => durationMinutes * MINUTE - workedMs(sessions, now);

/** Delayed: the VA has worked longer than the duration. */
export const isDelayed = (durationMinutes: number, sessions: readonly WorkSession[], now: Date) => remainingMs(durationMinutes, sessions, now) < 0;

/** The ids of the tasks whose work time is past their duration. */
export function delayedIds(tasks: readonly { id: string; durationMinutes: number }[], sessions: ReadonlyMap<string, readonly WorkSession[]>, now: Date): Set<string> {
  return new Set(tasks.filter((task) => isDelayed(task.durationMinutes, sessions.get(task.id) ?? [], now)).map((task) => task.id));
}

/** Monday 00:00 to the next Monday 00:00 in a zone, as UTC ISO instants: the package week. */
export function packageWeek(timeZone: string, now: Date): { start: string; end: string; monday: string } {
  const monday = startOfWeek(todayIn(timeZone, now), 1);
  return { start: instantInZone(monday, "00:00", timeZone), end: instantInZone(addDays(monday, 7), "00:00", timeZone), monday };
}

/** Milliseconds of the sessions that fall between `start` and `end` (a session across the edge is cut there). */
export function msBetween(sessions: readonly WorkSession[], start: string, end: string, now: Date): number {
  const from = Date.parse(start);
  const to = Date.parse(end);
  return sessions.reduce((sum, session) => {
    const a = Math.max(Date.parse(session.startedAt), from);
    const b = Math.min(session.endedAt === null ? now.getTime() : Date.parse(session.endedAt), to);
    return sum + Math.max(0, b - a);
  }, 0);
}

/** "45 min", "1 h", "1 h 30 min". Whole minutes, rounded down. */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A length of time in milliseconds, as formatMinutes says it. */
export const formatMs = (ms: number) => formatMinutes(Math.abs(ms) / MINUTE);

/** Hours with at most one decimal: "12.5", "3", "0". */
export const hoursLabel = (ms: number) => String(Math.round((ms / 3_600_000) * 10) / 10);
