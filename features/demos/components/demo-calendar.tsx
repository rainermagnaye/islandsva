"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { addDays, addMonths, formatDate, monthGrid, sameMonth, startOfWeek, type IsoDate } from "@/components/ui/date-math";
import { Icon } from "@/components/ui/icon";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { scheduleEventClass, type ScheduleEvent, type ScheduleGesture } from "@/components/ui/schedule-events";
import { shiftDay } from "@/components/ui/schedule-drag";
import { TONE_CLASSES, type Tone } from "@/components/ui/tone";
import { adminClientHref } from "@/content/routes";
import { cx } from "@/lib/cx";
import { demoCalendarEvents, type DemoCalendarRow } from "../calendar";
import { VA_TIME_ZONE } from "../contract";

export type CalendarLegendItem = { tone?: Tone; label: string; done?: boolean };

const LEGEND: readonly CalendarLegendItem[] = [
  { tone: "sand", label: "Requested" },
  { tone: "lagoon", label: "Confirmed" },
  { done: true, label: "Completed" },
  { tone: "coral", label: "Declined" },
  { tone: "ocean", label: "Cancelled" },
];

const VIEWS = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
] as const;

type CalendarView = (typeof VIEWS)[number]["id"];

const navButton = "grid size-11 place-items-center rounded-md hover:bg-action-ghost-hover";

/** Demo calls on a day, week, or month. The date opens a calendar to jump; a call opens the client unless the page handles the click. */
export function DemoCalendar({ rows, now, today, nowMinutes, extraEvents = [], toolbar, legend = LEGEND, onEventClick, onSlotClick, eventGesture, onEventMove }: {
  rows: readonly DemoCalendarRow[];
  now: string;
  today: IsoDate;
  nowMinutes: number;
  extraEvents?: readonly ScheduleEvent[];
  toolbar?: ReactNode;
  legend?: readonly CalendarLegendItem[];
  /** Return true when the page handled the event. Otherwise a demo call opens the client. */
  onEventClick?: (event: ScheduleEvent) => boolean;
  /** Empty hour, or a month day at 09:00. `minute` is minutes since midnight in Manila. */
  onSlotClick?: (day: IsoDate, minute: number) => void;
  eventGesture?: (event: ScheduleEvent) => ScheduleGesture | null;
  onEventMove?: (event: ScheduleEvent, next: { start: string; end: string }) => void | boolean | Promise<void | boolean>;
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("week");
  const [focus, setFocus] = useState(today);
  const [picking, setPicking] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const events = [...demoCalendarEvents(rows, new Date(now)), ...extraEvents];
  const openEvent = (event: ScheduleEvent) => {
    if (onEventClick?.(event)) return;
    const row = rows.find((item) => item.id === event.id);
    if (row) router.push(adminClientHref(row.clientId));
  };

  useEffect(() => {
    if (!picking) return;
    function close(event: PointerEvent) {
      if (!picker.current?.contains(event.target as Node)) setPicking(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPicking(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [picking]);

  function step(direction: -1 | 1) {
    if (view === "day") setFocus(addDays(focus, direction));
    else if (view === "week") setFocus(addDays(focus, direction * 7));
    else setFocus(addMonths(focus, direction));
  }

  const weekStart = startOfWeek(focus, 1);
  const range =
    view === "day"
      ? formatDate(focus, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : view === "month"
        ? formatDate(focus, { month: "long", year: "numeric" })
        : `${formatDate(weekStart, { month: "short", day: "numeric" })} – ${formatDate(addDays(weekStart, 6), { month: "short", day: "numeric", year: "numeric" })}`;

  const dateFilter = (
    <div ref={picker} className="relative flex items-center">
      <button type="button" aria-label="Previous" onClick={() => step(-1)} className={navButton}>
        <Icon name="chevron-left" size={20} />
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={picking}
        aria-label={`Choose a date, ${range}`}
        onClick={() => setPicking((open) => !open)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 type-body-sm text-ink hover:bg-action-ghost-hover"
      >
        <span aria-live="polite">{range}</span>
        <Icon name="calendar" size={18} className="text-ink-muted" />
      </button>
      <button type="button" aria-label="Next" onClick={() => step(1)} className={navButton}>
        <Icon name="chevron-right" size={20} />
      </button>
      {picking && (
        <div className="absolute top-full left-0 z-30 mt-1">
          <Calendar
            value={focus}
            onChange={(date) => {
              setFocus(date);
              setPicking(false);
            }}
            today={today}
            weekStartsOn={1}
            timeZone={VA_TIME_ZONE}
            className="elevation-md"
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="m-0 type-h1">Calendar</h1>
        <div className="flex flex-wrap items-center gap-3">
          {toolbar}
          <div role="group" aria-label="Calendar view" className="flex rounded-md border border-border bg-surface-card p-0.5">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={cx("min-h-9 rounded-sm px-3 type-label", view === item.id ? "bg-action-secondary text-on-action-secondary" : "text-ink-muted hover:bg-action-ghost-hover hover:text-ink")}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {view === "month" ? (
        <MonthBoard focus={focus} today={today} events={events} legend={legend} onEventClick={openEvent} onSlotClick={onSlotClick} eventGesture={eventGesture} onEventMove={onEventMove} filter={dateFilter} />
      ) : (
        <ScheduleCalendar
          showToolbar={false}
          leading={dateFilter}
          view={view}
          focus={focus}
          events={events}
          legend={legend}
          today={today}
          nowMinutes={nowMinutes}
          timeZone={VA_TIME_ZONE}
          onEventClick={openEvent}
          onSlotClick={onSlotClick}
          eventGesture={eventGesture}
          onEventMove={onEventMove}
        />
      )}
    </div>
  );
}

function MonthBoard({ focus, today, events, legend, onEventClick, onSlotClick, eventGesture, onEventMove, filter }: { focus: IsoDate; today: IsoDate; events: readonly ScheduleEvent[]; legend: readonly CalendarLegendItem[]; onEventClick: (event: ScheduleEvent) => void; onSlotClick?: (day: IsoDate, minute: number) => void; eventGesture?: (event: ScheduleEvent) => ScheduleGesture | null; onEventMove?: (event: ScheduleEvent, next: { start: string; end: string }) => void | boolean | Promise<void | boolean>; filter: ReactNode }) {
  const weeks = monthGrid(focus, 1);
  const names = weeks[0].map((day) => formatDate(day, { weekday: "short" }));
  const onDay = (day: IsoDate) => events.filter((event) => event.start.slice(0, 10) === day);
  const board = useRef<HTMLDivElement>(null);
  const [dropDay, setDropDay] = useState<IsoDate | null>(null);

  function beginMonthDrag(pointer: ReactPointerEvent<HTMLButtonElement>, event: ScheduleEvent) {
    if (!eventGesture?.(event)?.move) return;
    pointer.preventDefault();
    const origin = { x: pointer.clientX, y: pointer.clientY, id: pointer.pointerId, active: false, from: event.start.slice(0, 10) };
    const dayAt = (x: number, y: number) => {
      for (const cell of board.current?.querySelectorAll<HTMLElement>("[data-day]") ?? []) {
        const rect = cell.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return cell.dataset.day ?? null;
      }
      return null;
    };
    function move(native: PointerEvent) {
      if (native.pointerId !== origin.id) return;
      if (!origin.active && Math.hypot(native.clientX - origin.x, native.clientY - origin.y) < 4) return;
      origin.active = true;
      setDropDay(dayAt(native.clientX, native.clientY));
    }
    function finish(native: PointerEvent) {
      if (native.pointerId !== origin.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const day = origin.active ? dayAt(native.clientX, native.clientY) : null;
      setDropDay(null);
      if (day && day !== origin.from) {
        void onEventMove?.(event, { start: shiftDay(event.start, origin.from, day), end: shiftDay(event.end, origin.from, day) });
        return;
      }
      if (!origin.active) onEventClick(event);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  return (
    <Card as="section" aria-label={formatDate(focus, { month: "long", year: "numeric" })} padding="sm" className="grid gap-3 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {filter}
        <Legend items={legend} />
      </div>
      <div ref={board} className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border">
        {names.map((name) => (
          <div key={name} className="bg-surface-sunken px-2 py-2 text-center type-caption font-semibold tracking-wider text-ink-muted uppercase">
            {name}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const outside = !sameMonth(day, focus);
          const dayEvents = onDay(day);
          return (
            <div key={day} data-day={day} className={cx("grid min-h-24 content-start gap-1 p-1.5", outside ? "bg-surface-sunken" : "bg-surface-card", dropDay === day && "ring-2 ring-inset ring-action-secondary")}>
              {onSlotClick ? (
                <button type="button" aria-label={`Add a meeting on ${formatDate(day, { month: "long", day: "numeric" })}`} onClick={() => onSlotClick(day, 9 * 60)} className={cx("grid size-7 place-items-center justify-self-end rounded-pill type-caption font-bold tabular-nums", day === today ? "bg-action-secondary text-on-action-secondary" : outside ? "text-ink-muted" : "text-ink")}>
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span className={cx("grid size-7 place-items-center justify-self-end rounded-pill type-caption font-bold tabular-nums", day === today ? "bg-action-secondary text-on-action-secondary" : outside ? "text-ink-muted" : "text-ink")}>
                  {Number(day.slice(8))}
                </span>
              )}
              {dayEvents.slice(0, 3).map((event) => {
                const movable = Boolean(eventGesture?.(event)?.move);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={movable ? undefined : () => onEventClick(event)}
                    onPointerDown={movable ? (pointer) => beginMonthDrag(pointer, event) : undefined}
                    className={cx("flex min-w-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-left type-micro font-semibold", scheduleEventClass(event, false), movable && "cursor-grab touch-none")}
                  >
                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                    {event.done && <span aria-hidden="true" className="shrink-0">✓</span>}
                  </button>
                );
              })}
              {dayEvents.length > 3 && <span className="px-1.5 type-micro text-ink-muted">+{dayEvents.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Legend({ items }: { items: readonly CalendarLegendItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 type-caption text-ink-muted">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cx("size-3 rounded-sm", item.done ? "bg-tag-lagoon-ink" : cx("ring-[1.5px] ring-inset", TONE_CLASSES[item.tone ?? "lagoon"].bg, TONE_CLASSES[item.tone ?? "lagoon"].ring))} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
