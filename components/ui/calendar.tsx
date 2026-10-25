"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { addDays, addMonths, formatDate, isSelectable, monthGrid, sameMonth, startOfWeek, todayIn, type IsoDate } from "./date-math";
import { Icon } from "./icon";
import { TONE_CLASSES, type Tone } from "./tone";

export type CalendarProps = {
  value?: IsoDate | null;
  onChange?: (date: IsoDate) => void;
  mode?: "single" | "range";
  rangeValue?: { start?: IsoDate | null; end?: IsoDate | null };
  onRangeChange?: (range: { start: IsoDate; end: IsoDate | null }) => void;
  min?: IsoDate;
  max?: IsoDate;
  isDateDisabled?: (date: IsoDate) => boolean;
  /** Up to three dots per day; the day's name says how many events. */
  events?: Record<IsoDate, readonly { tone?: Tone; label?: string }[]>;
  /** Decides "today" (default: the viewer's zone). */
  timeZone?: string;
  today?: IsoDate;
  /** 0 = Sunday (default, as in the Philippines and the US), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  locale?: string;
  defaultMonth?: IsoDate;
  showOutsideDays?: boolean;
  footer?: ReactNode;
  /** Moves focus into the grid on mount (DatePicker opens this way). */
  autoFocus?: boolean;
  className?: string;
};

/** The key's new focused day, or null when the key isn't a grid move. */
export function moveFocus(key: string, focused: IsoDate, weekStartsOn: 0 | 1, shift = false): IsoDate | null {
  switch (key) {
    case "ArrowLeft": return addDays(focused, -1);
    case "ArrowRight": return addDays(focused, 1);
    case "ArrowUp": return addDays(focused, -7);
    case "ArrowDown": return addDays(focused, 7);
    case "Home": return startOfWeek(focused, weekStartsOn);
    case "End": return addDays(startOfWeek(focused, weekStartsOn), 6);
    case "PageUp": return addMonths(focused, shift ? -12 : -1);
    case "PageDown": return addMonths(focused, shift ? 12 : 1);
    default: return null;
  }
}

/**
 * A month grid for a date or a range, with event dots, unavailable days and full keyboard support (WAI-ARIA date
 * grid). Dates travel as ISO strings. Inside a form, use DatePicker; inline only when picking is the main task.
 */
export function Calendar({ value, onChange, mode = "single", rangeValue, onRangeChange, min, max, isDateDisabled, events, timeZone, today, weekStartsOn = 0, locale = "en-US", defaultMonth, showOutsideDays = true, footer, autoFocus = false, className }: CalendarProps) {
  const now = today ?? todayIn(timeZone);
  const start = mode === "range" ? rangeValue?.start ?? null : value ?? null;
  const end = mode === "range" ? rangeValue?.end ?? null : null;
  const [focused, setFocused] = useState<IsoDate>(start ?? defaultMonth ?? now);
  const [hovered, setHovered] = useState<IsoDate | null>(null);
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(autoFocus);

  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused]);

  const limits = { min, max, isDateDisabled };
  const month = focused;
  const weeks = monthGrid(month, weekStartsOn);
  const title = formatDate(month, { month: "long", year: "numeric" }, locale);
  const weekdays = weeks[0].map((day) => ({ short: formatDate(day, { weekday: "short" }, locale).slice(0, 2), long: formatDate(day, { weekday: "long" }, locale) }));
  const rangeEnd = end ?? (start && hovered && hovered > start ? hovered : null);

  function choose(day: IsoDate) {
    if (!isSelectable(day, limits)) return;
    if (mode === "single") onChange?.(day);
    else if (!start || end || day < start) onRangeChange?.({ start: day, end: null });
    else onRangeChange?.({ start, end: day });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(focused);
      return;
    }
    const next = moveFocus(event.key, focused, weekStartsOn, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    moved.current = true;
    setFocused(next);
  }

  const turn = (months: number) => setFocused(addMonths(month, months));
  const prevDisabled = Boolean(min && addMonths(month, -1).slice(0, 7) < min.slice(0, 7));
  const nextDisabled = Boolean(max && addMonths(month, 1).slice(0, 7) > max.slice(0, 7));
  const navButton = "grid size-11 place-items-center rounded-md text-ink hover:bg-action-ghost-hover disabled:cursor-not-allowed disabled:text-disabled-ink disabled:hover:bg-transparent";

  return (
    <div className={cx("inline-grid min-w-[296px] gap-2 rounded-lg border border-border bg-surface-card p-4 text-ink", className)}>
      <div className="flex items-center gap-1">
        <h2 aria-live="polite" className="m-0 ml-2 flex-1 type-body-md font-semibold">
          {title}
        </h2>
        <button type="button" aria-label="Previous month" className={navButton} disabled={prevDisabled} onClick={() => turn(-1)}>
          <Icon name="chevron-left" size={20} />
        </button>
        <button type="button" aria-label="Next month" className={navButton} disabled={nextDisabled} onClick={() => turn(1)}>
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
      <table ref={grid} role="grid" aria-label={title} onKeyDown={onKeyDown} className="w-full border-separate border-spacing-y-0.5">
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th key={day.long} scope="col" abbr={day.long} className="pb-1.5 type-caption font-semibold text-ink-muted">
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const outside = !sameMonth(day, month);
                if (outside && !showOutsideDays) return <td key={day} />;
                const selectable = isSelectable(day, limits);
                const selected = day === start || day === end;
                const inRange = Boolean(start && rangeEnd && day > start && day < rangeEnd);
                const dayEvents = events?.[day] ?? [];
                const label = [
                  formatDate(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, locale),
                  day === now && "today",
                  dayEvents.length > 0 && `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`,
                  !selectable && "unavailable",
                ].filter(Boolean).join(", ");
                return (
                  <td
                    key={day}
                    role="gridcell"
                    aria-selected={selected || inRange}
                    className={cx(
                      "p-0 text-center",
                      inRange && "bg-status-info-bg",
                      mode === "range" && day === start && rangeEnd && "bg-[linear-gradient(90deg,transparent_50%,var(--color-status-info-bg)_50%)]",
                      mode === "range" && day === rangeEnd && start && "bg-[linear-gradient(90deg,var(--color-status-info-bg)_50%,transparent_50%)]",
                    )}
                  >
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      aria-label={label}
                      aria-disabled={!selectable || undefined}
                      onClick={() => {
                        setFocused(day);
                        choose(day);
                      }}
                      onPointerEnter={() => setHovered(day)}
                      className={cx(
                        "relative mx-px inline-grid size-10 place-items-center rounded-pill type-body-md font-medium tabular-nums transition-colors",
                        inRange && "rounded-none",
                        selected
                          ? "bg-action-secondary font-bold text-on-action-secondary"
                          : !selectable
                            ? "cursor-not-allowed text-disabled-ink line-through decoration-border-strong"
                            : cx("hover:bg-action-ghost-hover", outside ? "text-ink-muted" : "text-ink", day === now && "font-bold text-action-secondary ring-[1.5px] ring-action-secondary ring-inset"),
                      )}
                    >
                      {Number(day.slice(8))}
                      {dayEvents.length > 0 && (
                        <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                          {dayEvents.slice(0, 3).map((event, i) => (
                            <span key={i} className={cx("size-1 rounded-pill", selected ? "bg-on-action-secondary" : TONE_CLASSES[event.tone ?? "lagoon"].fill)} />
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="flex justify-between gap-2 border-t border-border pt-2">{footer}</div>}
    </div>
  );
}
