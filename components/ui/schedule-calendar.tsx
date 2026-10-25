"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { addDays, clockLabel, dayOfWeek, formatDate, layoutDay, minutesOf, startOfWeek, todayIn, type IsoDate, type IsoLocalDateTime } from "./date-math";
import { Icon } from "./icon";
import { TONE_CLASSES, type Tone } from "./tone";

export type ScheduleEvent = { id: string; title: string; start: IsoLocalDateTime; end: IsoLocalDateTime; tone?: Tone; who?: string };
export type ScheduleShift = { kind: "day" | "night"; start: string; end: string; label?: string; days?: readonly number[] };

type ScheduleCalendarProps = {
  events?: readonly ScheduleEvent[];
  shifts?: readonly ScheduleShift[];
  /** Describe up to four category tones. */
  legend?: readonly { tone: Tone; label: string }[];
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
  actions?: ReactNode;
  onEventClick?: (event: ScheduleEvent) => void;
  className?: string;
};

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

const SHIFT = { day: { classes: "bg-shift-day-bg text-shift-day-ink", icon: "sun" }, night: { classes: "bg-shift-night-bg text-shift-night-ink", icon: "moon" } } as const;

/**
 * A week of a client's coverage: day and night shifts as soft bands, events on top, the now-line, and a
 * day-by-day agenda under 640px of container width. For viewing and clicking through; editing (drag, resize)
 * belongs to a scheduler library skinned with these tokens.
 */
export function ScheduleCalendar({ events = [], shifts = [], legend = [], weekOf, today, nowMinutes, timeZone = "Asia/Manila", weekStartsOn = 1, locale = "en-US", startHour = 0, endHour = 24, hourHeight = 44, scrollToHour = 8, height = 520, title = "This week", actions, onEventClick, className }: ScheduleCalendarProps) {
  const now = today ?? todayIn(timeZone);
  const [week, setWeek] = useState(startOfWeek(weekOf ?? now, weekStartsOn));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const scroller = useRef<HTMLDivElement>(null);
  const top = (minutes: number) => ((minutes - startHour * 60) / 60) * hourHeight;
  const bodyHeight = (endHour - startHour) * hourHeight;
  const zoneName = timeZone.split("/").pop()?.replace(/_/g, " ");

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (scrollToHour - startHour) * hourHeight);
  }, [scrollToHour, startHour, hourHeight]);

  const eventName = (event: ScheduleEvent) =>
    `${event.title}, ${formatDate(event.start.slice(0, 10), { weekday: "long", month: "long", day: "numeric" }, locale)}, ${clockLabel(minutesOf(event.start))}–${clockLabel(minutesOf(event.end))}${event.who ? `, with ${event.who}` : ""}`;
  const eventsOn = (day: IsoDate) => events.filter((event) => event.start.slice(0, 10) === day);

  return (
    <section aria-label={title} className={cx("@container grid gap-3 rounded-lg border border-border bg-surface-card p-4 text-ink", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="m-0 type-body-md font-semibold">{title}</h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))} className="grid size-11 place-items-center rounded-md hover:bg-action-ghost-hover">
            <Icon name="chevron-left" size={20} />
          </button>
          <span aria-live="polite" className="type-body-sm text-ink-muted">
            {formatDate(days[0], { month: "short", day: "numeric" }, locale)} – {formatDate(days[6], { month: "short", day: "numeric", year: "numeric" }, locale)}
          </span>
          <button type="button" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))} className="grid size-11 place-items-center rounded-md hover:bg-action-ghost-hover">
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
        <ul className="m-0 ml-auto flex list-none flex-wrap gap-x-4 gap-y-1 p-0 type-caption text-ink-muted">
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cx("size-3 rounded-sm ring-[1.5px] ring-inset", TONE_CLASSES[item.tone].bg, TONE_CLASSES[item.tone].ring)} />
              {item.label}
            </li>
          ))}
        </ul>
        {actions}
      </div>

      {/* The week grid, from 640px of container width. */}
      <div className="hidden overflow-hidden rounded-md border border-border @[640px]:grid">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface-sunken">
          <span className="self-end px-1.5 pb-1.5 text-right type-caption text-ink-muted">{zoneName}</span>
          {days.map((day) => (
            <div key={day} className="grid justify-items-center gap-0.5 border-l border-border py-2">
              <span className={cx("type-caption font-semibold tracking-wider uppercase", day === now ? "text-action-secondary" : "text-ink-muted")}>{formatDate(day, { weekday: "short" }, locale)}</span>
              <span className={cx("grid size-8 place-items-center rounded-pill type-body-md font-bold tabular-nums", day === now && "bg-action-secondary text-on-action-secondary")}>{Number(day.slice(8))}</span>
            </div>
          ))}
        </div>
        <div ref={scroller} className="overflow-y-auto overscroll-contain" style={{ maxHeight: height }}>
          <div
            className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
            style={{ height: bodyHeight, backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${hourHeight}px)` }}
          >
            <div className="relative">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 type-caption whitespace-nowrap text-ink-muted" style={{ top: i * hourHeight }}>
                  {i === 0 ? "" : clockLabel((startHour + i) * 60)}
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div key={day} role="group" aria-label={formatDate(day, { weekday: "long", month: "long", day: "numeric" }, locale)} className={cx("relative border-l border-border", day === now && "bg-status-info-bg/45")}>
                {shiftBands(shifts, day).map((band, i) => (
                  <div key={i} className={cx("pointer-events-none absolute inset-x-0", SHIFT[band.kind].classes)} style={{ top: top(band.from), height: top(band.to) - top(band.from) }}>
                    <span className="sticky top-0 flex items-center gap-1 px-1.5 py-1 type-micro font-bold tracking-wide uppercase">
                      <Icon name={SHIFT[band.kind].icon} size={13} />
                      {band.label ?? (band.kind === "day" ? "Day shift" : "Night shift")}
                    </span>
                  </div>
                ))}
                {layoutDay(eventsOn(day)).map(({ event, lane, lanes }) => {
                  const from = minutesOf(event.start);
                  const to = Math.max(minutesOf(event.end), from + 15);
                  const short = to - from < 45;
                  const tone = TONE_CLASSES[event.tone ?? "lagoon"];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      aria-label={eventName(event)}
                      onClick={() => onEventClick?.(event)}
                      className={cx("absolute z-[1] grid content-start gap-px overflow-hidden rounded-sm px-1.5 py-1 text-left ring-[1.5px] ring-surface-card hover:z-[2] hover:-translate-y-px hover:elevation-md focus-visible:z-[3]", tone.bg, tone.ink, short && "grid-flow-col justify-start gap-1.5 pt-0.5")}
                      style={{ top: top(from), height: Math.max(top(to) - top(from), 20), left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                    >
                      <span className="truncate type-caption font-semibold">{event.title}</span>
                      {!short && <span className="truncate type-micro opacity-90">{clockLabel(from)}–{clockLabel(to)}{event.who ? ` · ${event.who}` : ""}</span>}
                    </button>
                  );
                })}
                {day === now && nowMinutes !== undefined && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
                  <div aria-hidden="true" className="pointer-events-none absolute -left-px right-0 z-[4] h-0.5 bg-ink-accent before:absolute before:-top-1 before:-left-1.5 before:size-2.5 before:rounded-pill before:bg-ink-accent" style={{ top: top(nowMinutes) }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The agenda, under 640px of container width. */}
      <ol className="m-0 grid list-none p-0 @[640px]:hidden">
        {days.map((day) => {
          const dayEvents = [...eventsOn(day)].sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={day} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-t border-border py-3">
              <span className={cx("grid content-start justify-items-center", day === now && "text-action-secondary")}>
                <span className="type-caption font-semibold uppercase">{formatDate(day, { weekday: "short" }, locale)}</span>
                <span className="type-h4 tabular-nums">{Number(day.slice(8))}</span>
              </span>
              {dayEvents.length === 0 ? (
                <span className="self-center type-body-sm text-ink-muted">Nothing scheduled</span>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <button type="button" aria-label={eventName(event)} onClick={() => onEventClick?.(event)} className={cx("grid min-h-11 w-full gap-0.5 rounded-md px-3 py-2 text-left", TONE_CLASSES[event.tone ?? "lagoon"].bg, TONE_CLASSES[event.tone ?? "lagoon"].ink)}>
                        <span className="type-label">{event.title}</span>
                        <span className="type-caption">{clockLabel(minutesOf(event.start))}–{clockLabel(minutesOf(event.end))}{event.who ? ` · ${event.who}` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
