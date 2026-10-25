// Pure date helpers for Calendar, DatePicker, TimeSlotPicker and ScheduleCalendar. Dates travel as ISO strings
// ("2026-10-16", "2026-10-16T09:30"), never Date objects, so they can't drift across time zones between the
// server and the browser. Day arithmetic runs in UTC, where every day has 24 hours.

export type IsoDate = string;
export type IsoLocalDateTime = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const utc = (iso: IsoDate) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (iso: IsoDate, days: number) => toIso(new Date(utc(iso).getTime() + days * 86_400_000));

/** Same day of another month, clamped to that month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(iso: IsoDate, months: number) {
  const date = utc(iso);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return toIso(target);
}

export const startOfMonth = (iso: IsoDate) => `${iso.slice(0, 7)}-01`;
export const dayOfWeek = (iso: IsoDate) => utc(iso).getUTCDay();
export const sameMonth = (a: IsoDate, b: IsoDate) => a.slice(0, 7) === b.slice(0, 7);

/** The first day of the week holding `iso`. */
export const startOfWeek = (iso: IsoDate, weekStartsOn: 0 | 1 = 0) => addDays(iso, -((dayOfWeek(iso) - weekStartsOn + 7) % 7));

/** Six weeks of days covering the month of `iso`, as rows of seven ISO dates. */
export function monthGrid(iso: IsoDate, weekStartsOn: 0 | 1 = 0): IsoDate[][] {
  const first = startOfWeek(startOfMonth(iso), weekStartsOn);
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
}

/** Today's date in a time zone (default: the viewer's). */
export function todayIn(timeZone?: string, now = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whether a day may be picked: inside min/max and not disabled by the consumer. ISO strings compare in order. */
export function isSelectable(iso: IsoDate, limits: { min?: IsoDate; max?: IsoDate; isDateDisabled?: (date: IsoDate) => boolean }) {
  if (limits.min && iso < limits.min) return false;
  if (limits.max && iso > limits.max) return false;
  return !limits.isDateDisabled?.(iso);
}

/** Formats a calendar date without shifting it: the date is read in UTC, where it was built. */
export const formatDate = (iso: IsoDate, options: Intl.DateTimeFormatOptions, locale = "en-US") =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(utc(iso));

/** Minutes since midnight of a wall-clock time ("09:30" or "2026-10-16T09:30"). */
export function minutesOf(time: string) {
  const clock = time.includes("T") ? time.slice(11, 16) : time.slice(0, 5);
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "9 am", "9:30 pm" for a minute count; 24:00 reads as "12 am". */
export function clockLabel(minutes: number) {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  const hour12 = hours % 12 || 12;
  return `${hour12}${rest ? `:${String(rest).padStart(2, "0")}` : ""} ${hours < 12 ? "am" : "pm"}`;
}

/**
 * The same wall-clock moment read in another zone: `local` is written in `fromZone`. Uses IANA names, so
 * daylight-saving changes are handled; returns "HH:MM" and the date in `toZone`.
 */
export function convertWallClock(local: IsoLocalDateTime, fromZone: string, toZone: string) {
  // Read the wall clock as UTC, then subtract the zone's offset; a second pass uses the offset at the corrected
  // instant, which settles daylight-saving edges.
  const wall = Date.parse(`${local}:00Z`);
  let instant = wall - offsetMinutes(fromZone, new Date(wall)) * 60_000;
  instant = wall - offsetMinutes(fromZone, new Date(instant)) * 60_000;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: toZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** A zone's offset from UTC in minutes at an instant (Manila = +480). */
export function offsetMinutes(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Morning (before noon), afternoon (before 5 pm) or evening, for grouping time slots. */
export const partOfDay = (time: IsoLocalDateTime) => {
  const minutes = minutesOf(time);
  return minutes < 12 * 60 ? "morning" : minutes < 17 * 60 ? "afternoon" : "evening";
};

/**
 * Side-by-side columns for overlapping events in one day: each event gets its lane and the lane count of its
 * overlap cluster, so the cluster splits the column evenly.
 */
export function layoutDay<T extends { start: string; end: string }>(events: readonly T[]) {
  const sorted = [...events].sort((a, b) => minutesOf(a.start) - minutesOf(b.start) || minutesOf(b.end) - minutesOf(a.end));
  const placed: { event: T; lane: number; lanes: number }[] = [];
  let cluster: { event: T; lane: number; lanes: number }[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((item) => item.lane + 1));
    for (const item of cluster) item.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
  };
  for (const event of sorted) {
    const start = minutesOf(event.start);
    const end = Math.max(minutesOf(event.end), start + 15);
    if (start >= clusterEnd && cluster.length) close();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    cluster.push({ event, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) close();
  return placed;
}
