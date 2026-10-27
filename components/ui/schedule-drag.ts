import { addDays, minutesOf, type IsoDate, type IsoLocalDateTime } from "./date-math";

export type MinuteRange = { start: number; end: number };

/** Where a dragged or stretched meeting lands, in minutes from midnight of the drop day. */
export function placeEvent(
  range: MinuteRange,
  pointerMinutes: number,
  options: { mode: "move" | "resize"; snap: number; minLength: number; maxLength: number; dayStart: number; dayEnd: number },
): MinuteRange {
  const snapTo = (value: number) => Math.round(value / options.snap) * options.snap;
  const length = Math.min(options.maxLength, Math.max(options.minLength, range.end - range.start));
  if (options.mode === "resize") {
    const end = Math.min(range.start + options.maxLength, Math.max(range.start + options.minLength, snapTo(pointerMinutes)));
    return { start: range.start, end };
  }
  const start = Math.min(options.dayEnd - options.snap, Math.max(options.dayStart, snapTo(pointerMinutes)));
  return { start, end: start + length };
}

/** Minutes from `start` to `end`, counting a meeting that runs past midnight. */
export function spanMinutes(start: IsoLocalDateTime, end: IsoLocalDateTime) {
  const days = Math.round((Date.parse(`${end.slice(0, 10)}T00:00:00Z`) - Date.parse(`${start.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return days * 1440 + minutesOf(end) - minutesOf(start);
}

/** `minutes` past midnight of `day`, as a wall clock. 25:00 is 01:00 the next day. */
export function atMinutes(day: IsoDate, minutes: number): IsoLocalDateTime {
  const extra = Math.floor(minutes / 1440);
  const clock = minutes - extra * 1440;
  const date = extra === 0 ? day : addDays(day, extra);
  return `${date}T${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
}

/** The same clock on another day. A meeting that ended the next morning keeps that extra day. */
export function shiftDay(local: IsoLocalDateTime, fromDay: IsoDate, toDay: IsoDate): IsoLocalDateTime {
  const origin = local.slice(0, 10);
  const time = local.slice(11, 16);
  if (origin === fromDay) return `${toDay}T${time}`;
  const extra = Math.round((Date.parse(`${origin}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
  return `${addDays(toDay, extra)}T${time}`;
}
