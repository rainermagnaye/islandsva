import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { dayOfWeek, minutesOf, type IsoDate, type IsoLocalDateTime } from "./date-math";
import { TONE_CLASSES, type Tone } from "./tone";

// ScheduleCalendar's data shapes and pure rules (event tone classes, shift bands), kept apart from the
// component so the rules are testable without React.

export type ScheduleEvent = { id: string; title: string; start: IsoLocalDateTime; end: IsoLocalDateTime; tone?: Tone; who?: string; pending?: boolean; done?: boolean };

/** How far a meeting may be dragged. A discovery call moves but keeps its 30 minutes. */
export type ScheduleGesture = { move: boolean; resize: boolean; snap: number; minLength: number; maxLength: number };

/** Fill for a calendar chip. A finished booking is the solid lagoon, so it reads apart from a scheduled one. */
export function scheduleEventClass(event: Pick<ScheduleEvent, "tone" | "pending" | "done">, framed = true) {
  const tone = TONE_CLASSES[event.tone ?? "lagoon"];
  if (event.done) return "bg-tag-lagoon-ink text-tag-lagoon-bg";
  if (event.pending) return cx(framed ? "border-2 border-dashed border-current bg-transparent" : "border border-dashed border-current bg-transparent", tone.ink);
  return cx(framed && "ring-[1.5px] ring-surface-card", tone.bg, tone.ink);
}

export type ScheduleShift = { kind: "day" | "night"; start: string; end: string; label?: string; days?: readonly number[] };

/** The part of each shift that falls on `day`, in minutes; overnight shifts are split across midnight. */
export function shiftBands(shifts: readonly ScheduleShift[], day: IsoDate) {
  const weekday = dayOfWeek(day);
  const yesterday = (weekday + 6) % 7;
  const bands: { kind: ScheduleShift["kind"]; label?: string; from: number; to: number }[] = [];
  for (const shift of shifts) {
    const from = minutesOf(shift.start);
    const to = minutesOf(shift.end);
    const on = (d: number) => !shift.days || shift.days.includes(d);
    if (to > from) {
      if (on(weekday)) bands.push({ kind: shift.kind, label: shift.label, from, to });
    } else {
      if (on(weekday)) bands.push({ kind: shift.kind, label: shift.label, from, to: 24 * 60 });
      if (on(yesterday) && to > 0) bands.push({ kind: shift.kind, label: shift.label, from: 0, to });
    }
  }
  return bands;
}

export type ScheduleCalendarProps = {
  events?: readonly ScheduleEvent[];
  shifts?: readonly ScheduleShift[];
  /** Category tones, plus a finished booking when `done` is set. */
  legend?: readonly { tone?: Tone; label: string; done?: boolean }[];
  /** One day, or the week that holds it. Week is the default. */
  view?: "day" | "week";
  /** The day the view is anchored on. When set, the parent owns previous and next. */
  focus?: IsoDate;
  weekOf?: IsoDate;
  today?: IsoDate;
  /** Minutes since midnight in `timeZone`, for the now-line. */
  nowMinutes?: number;
  /** The whole view is in this zone (the client's), named in the corner. */
  timeZone?: string;
  weekStartsOn?: 0 | 1;
  locale?: string;
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  scrollToHour?: number;
  height?: number;
  title?: string;
  /** The built-in title and week stepper. Turn off when the page draws its own. */
  showToolbar?: boolean;
  /** Sits on the left of the legend row, for a page that owns the date stepper. */
  leading?: ReactNode;
  actions?: ReactNode;
  onEventClick?: (event: ScheduleEvent) => void;
  /** When set, that meeting can be dragged. Absent means click only. */
  eventGesture?: (event: ScheduleEvent) => ScheduleGesture | null;
  /** A drop or a stretch. `start` and `end` are wall clocks in the calendar's zone. */
  onEventMove?: (event: ScheduleEvent, next: { start: IsoLocalDateTime; end: IsoLocalDateTime }) => void | boolean | Promise<void | boolean>;
  /** An empty hour. `minute` is the start of that hour in the calendar's zone. */
  onSlotClick?: (day: IsoDate, minute: number) => void;
  className?: string;
};
