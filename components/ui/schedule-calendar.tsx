"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { addDays, clockLabel, dayOfWeek, formatDate, layoutDay, minutesOf, startOfWeek, todayIn, type IsoDate, type IsoLocalDateTime } from "./date-math";
import { atMinutes, placeEvent, spanMinutes } from "./schedule-drag";
import { cardSurface } from "./card-surface";
import { Icon } from "./icon";
import { TONE_CLASSES, type Tone } from "./tone";

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

type ScheduleCalendarProps = {
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
 * day-by-day agenda under 640px of container width. Drag and stretch are on when the page passes `eventGesture`.
 */
export function ScheduleCalendar({ events = [], shifts = [], legend = [], view = "week", focus, weekOf, today, nowMinutes, timeZone = "Asia/Manila", weekStartsOn = 1, locale = "en-US", startHour = 0, endHour = 24, hourHeight = 44, scrollToHour = 8, height = 520, title = "This week", showToolbar = true, leading, actions, onEventClick, eventGesture, onEventMove, onSlotClick, className }: ScheduleCalendarProps) {
  const now = today ?? todayIn(timeZone);
  const anchor = focus ?? weekOf ?? now;
  const [week, setWeek] = useState(startOfWeek(anchor, weekStartsOn));
  const start = focus !== undefined ? (view === "day" ? focus : startOfWeek(focus, weekStartsOn)) : view === "day" ? anchor : week;
  const days = Array.from({ length: view === "day" ? 1 : 7 }, (_, i) => addDays(start, i));
  const columns = view === "day" ? "56px minmax(0,1fr)" : "56px repeat(7, minmax(0,1fr))";
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const skipClick = useRef(false);
  type LiveEvent = { id: string; start: IsoLocalDateTime; end: IsoLocalDateTime; originStart: IsoLocalDateTime; originEnd: IsoLocalDateTime; settled: boolean };
  const liveRef = useRef<LiveEvent | null>(null);
  const [live, setLive] = useState<LiveEvent | null>(null);
  const top = (minutes: number) => ((minutes - startHour * 60) / 60) * hourHeight;
  const bodyHeight = (endHour - startHour) * hourHeight;
  const zoneName = timeZone.split("/").pop()?.replace(/_/g, " ");

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (scrollToHour - startHour) * hourHeight);
  }, [scrollToHour, startHour, hourHeight]);

  useEffect(() => {
    const current = liveRef.current;
    if (!current?.settled) return;
    const event = events.find((item) => item.id === current.id);
    if (!event || event.start !== current.originStart || event.end !== current.originEnd) {
      liveRef.current = null;
      setLive(null);
    }
  }, [events]);

  const eventName = (event: ScheduleEvent) =>
    `${event.done ? "Completed: " : ""}${event.title}, ${formatDate(event.start.slice(0, 10), { weekday: "long", month: "long", day: "numeric" }, locale)}, ${clockLabel(minutesOf(event.start))}–${clockLabel(minutesOf(event.end))}${event.who ? `, with ${event.who}` : ""}`;
  const placed = live ? events.map((event) => (event.id === live.id ? { ...event, start: live.start, end: live.end } : event)) : events;
  const eventsOn = (day: IsoDate) => placed.filter((event) => event.start.slice(0, 10) === day);

  function beginDrag(pointer: ReactPointerEvent<HTMLButtonElement>, event: ScheduleEvent) {
    const gesture = eventGesture?.(event);
    if (!gesture || (!gesture.move && !gesture.resize)) return;
    const resizing = Boolean((pointer.target as HTMLElement).closest("[data-resize]"));
    if (resizing ? !gesture.resize : !gesture.move) return;
    pointer.preventDefault();
    pointer.stopPropagation();
    const length = Math.max(spanMinutes(event.start, event.end), gesture.minLength);
    const startMin = minutesOf(event.start);
    const column = pointer.currentTarget.closest<HTMLElement>("[data-day]");
    const pointerMinutes = (clientY: number, columnTop: number) => startHour * 60 + ((clientY - columnTop) / hourHeight) * 60;
    const originTop = column?.getBoundingClientRect().top ?? pointer.clientY;
    const state = {
      pointerId: pointer.pointerId,
      active: false,
      mode: resizing ? "resize" as const : "move" as const,
      grab: pointerMinutes(pointer.clientY, originTop) - startMin,
      event,
      startMin,
      endMin: startMin + length,
      gesture,
    };

    function columnAt(x: number, y: number) {
      const columns = grid.current?.querySelectorAll<HTMLElement>("[data-day]") ?? [];
      for (const item of columns) {
        const rect = item.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return item;
      }
      return column;
    }

    function move(native: PointerEvent) {
      if (native.pointerId !== state.pointerId) return;
      if (!state.active && Math.hypot(native.clientX - pointer.clientX, native.clientY - pointer.clientY) < 4) return;
      state.active = true;
      const target = state.mode === "resize" ? column : columnAt(native.clientX, native.clientY);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const pointed = pointerMinutes(native.clientY, rect.top) - (state.mode === "move" ? state.grab : 0);
      const placed = placeEvent(
        { start: state.startMin, end: state.endMin },
        state.mode === "resize" ? pointerMinutes(native.clientY, rect.top) : pointed,
        { mode: state.mode, snap: state.gesture.snap, minLength: state.gesture.minLength, maxLength: state.gesture.maxLength, dayStart: startHour * 60, dayEnd: endHour * 60 },
      );
      const day = target.dataset.day ?? event.start.slice(0, 10);
      const next: LiveEvent = {
        id: event.id,
        start: atMinutes(day, placed.start),
        end: atMinutes(day, placed.end),
        originStart: event.start,
        originEnd: event.end,
        settled: false,
      };
      liveRef.current = next;
      setLive(next);
    }

    function finish(native: PointerEvent) {
      if (native.pointerId !== state.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      const current = liveRef.current;
      if (state.active && current && (current.start !== event.start || current.end !== event.end)) {
        skipClick.current = true;
        const settled = { ...current, settled: true };
        liveRef.current = settled;
        setLive(settled);
        void Promise.resolve(onEventMove?.(event, { start: current.start, end: current.end })).then((saved) => {
          if (saved === false && liveRef.current === settled) {
            liveRef.current = null;
            setLive(null);
          }
        });
        return;
      }
      liveRef.current = null;
      setLive(null);
      if (!state.active) onEventClick?.(event);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
  }

  return (
    <section aria-label={title} className={cx("@container grid gap-3 p-4 text-ink", cardSurface, className)}>
      {(showToolbar || leading || legend.length > 0 || actions) && (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {leading}
        {showToolbar && (
          <>
            <h2 className="m-0 type-body-md font-semibold">{title}</h2>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))} className="grid size-11 place-items-center rounded-md hover:bg-action-ghost-hover">
                <Icon name="chevron-left" size={20} />
              </button>
              <span aria-live="polite" className="type-body-sm text-ink-muted">
                {formatDate(days[0], { month: "short", day: "numeric" }, locale)} – {formatDate(days[Math.max(days.length - 1, 0)], { month: "short", day: "numeric", year: "numeric" }, locale)}
              </span>
              <button type="button" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))} className="grid size-11 place-items-center rounded-md hover:bg-action-ghost-hover">
                <Icon name="chevron-right" size={20} />
              </button>
            </div>
          </>
        )}
        <ul className={cx("m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 type-caption text-ink-muted", Boolean(showToolbar || leading) && "ml-auto")}>
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cx("size-3 rounded-sm", item.done ? "bg-tag-lagoon-ink" : cx("ring-[1.5px] ring-inset", TONE_CLASSES[item.tone ?? "lagoon"].bg, TONE_CLASSES[item.tone ?? "lagoon"].ring))} />
              {item.label}
            </li>
          ))}
        </ul>
        {actions}
      </div>
      )}

      {/* Header and hours share one scrollport, so the day lines stay under the day names when a scrollbar appears. */}
      <div className="hidden overflow-hidden rounded-md border border-border @[640px]:block">
        <div ref={scroller} className="overflow-y-auto overscroll-contain" style={{ maxHeight: height }}>
          <div className="sticky top-0 z-10 grid border-b border-border bg-surface-sunken" style={{ gridTemplateColumns: columns }}>
            <span className="self-end px-1.5 pb-1.5 text-right type-caption text-ink-muted">{zoneName}</span>
            {days.map((day) => (
              <div key={day} className="grid justify-items-center gap-0.5 border-l border-border py-2">
                <span className={cx("type-caption font-semibold tracking-wider uppercase", day === now ? "text-action-secondary" : "text-ink-muted")}>{formatDate(day, { weekday: "short" }, locale)}</span>
                <span className={cx("grid size-8 place-items-center rounded-pill type-body-md font-bold tabular-nums", day === now && "bg-action-secondary text-on-action-secondary")}>{Number(day.slice(8))}</span>
              </div>
            ))}
          </div>
          <div
            ref={grid}
            className="relative grid"
            style={{ gridTemplateColumns: columns, height: bodyHeight, backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${hourHeight}px)` }}
          >
            <div className="relative">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 type-caption whitespace-nowrap text-ink-muted" style={{ top: i * hourHeight }}>
                  {i === 0 ? "" : clockLabel((startHour + i) * 60)}
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div
                key={day}
                role="group"
                aria-label={formatDate(day, { weekday: "long", month: "long", day: "numeric" }, locale)}
                data-day={day}
                className={cx("relative border-l border-border", day === now && "bg-status-info-bg/45", onSlotClick && "cursor-pointer")}
                onClick={onSlotClick ? (event) => {
                  if (skipClick.current) {
                    skipClick.current = false;
                    return;
                  }
                  if ((event.target as HTMLElement).closest("button")) return;
                  const index = Math.min(endHour - startHour - 1, Math.max(0, Math.floor((event.clientY - event.currentTarget.getBoundingClientRect().top) / hourHeight)));
                  onSlotClick(day, (startHour + index) * 60);
                } : undefined}
              >
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
                  const to = from + Math.max(spanMinutes(event.start, event.end), 15);
                  const short = to - from < 45;
                  const gesture = eventGesture?.(event);
                  const draggable = Boolean(gesture && (gesture.move || gesture.resize));
                  return (
                    <button
                      key={event.id}
                      type="button"
                      aria-label={eventName(event)}
                      onClick={draggable ? undefined : () => onEventClick?.(event)}
                      onPointerDown={draggable ? (pointer) => beginDrag(pointer, event) : undefined}
                      className={cx("absolute z-[1] grid content-start gap-px overflow-hidden rounded-sm px-1.5 py-1 text-left hover:z-[2] hover:-translate-y-px hover:elevation-md focus-visible:z-[3]", scheduleEventClass(event), event.done && "pr-5", short && "grid-flow-col justify-start gap-1.5 pt-0.5", draggable && "touch-none", gesture?.move && "cursor-grab")}
                      style={{ top: top(from), height: Math.max(top(to) - top(from), 20), left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                    >
                      <span className="min-w-0 truncate type-caption font-semibold">{event.title}</span>
                      {event.done && <span aria-hidden="true" className="absolute top-0.5 right-1 type-caption font-semibold">✓</span>}
                      {!short && <span className="truncate type-micro opacity-90">{clockLabel(from)}–{clockLabel(to)}{event.who ? ` · ${event.who}` : ""}</span>}
                      {gesture?.resize && <span data-resize="end" className="absolute inset-x-0 bottom-0 h-3 cursor-ns-resize" />}
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
                      <button type="button" aria-label={eventName(event)} onClick={() => onEventClick?.(event)} className={cx("relative grid min-h-11 w-full gap-0.5 rounded-md px-3 py-2 text-left", scheduleEventClass(event, false), event.done && "pr-8")}>
                        <span className="type-label">{event.title}</span>
                        {event.done && <span aria-hidden="true" className="absolute top-2 right-3 type-label">✓</span>}
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
