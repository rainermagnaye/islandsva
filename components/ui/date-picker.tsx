"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { Calendar, type CalendarProps } from "./calendar";
import { formatDate, todayIn, type IsoDate } from "./date-math";
import { Field, controlClasses, describedBy } from "./field";
import { Icon } from "./icon";

type DatePickerProps = Pick<CalendarProps, "min" | "max" | "isDateDisabled" | "events" | "timeZone" | "today" | "weekStartsOn" | "locale"> & {
  label: string;
  value?: IsoDate | null;
  defaultValue?: IsoDate | null;
  onChange?: (date: IsoDate | null) => void;
  /** Adds a hidden input carrying the ISO value into form posts and Server Actions. */
  name?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * A form field that opens a Calendar in a small popover. Shows "Mon, Oct 19, 2026" (the weekday prevents
 * mistakes) and sends ISO. Opening focuses the chosen day; choosing, Escape or a click outside closes it and
 * returns focus to the field. Validate on the server too.
 */
export function DatePicker({ label, value, defaultValue = null, onChange, name, hint, error, required, disabled, placeholder = "Choose a date", id: givenId, className, ...calendar }: DatePickerProps) {
  const autoId = useId();
  const id = givenId ?? `date-${name ?? autoId}`;
  const [inner, setInner] = useState<IsoDate | null>(defaultValue);
  const date = value === undefined ? inner : value;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const shown = date ? formatDate(date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }, calendar.locale) : null;

  function set(next: IsoDate | null) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
    button.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div ref={root} className={cx("relative", className)}>
      <Field id={id} label={label} hint={open ? undefined : hint} error={open ? undefined : error} required={required}>
        <button
          ref={button}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={describedBy(id, hint, error)}
          aria-label={`${label}, ${shown ?? "no date chosen"}`}
          onClick={() => setOpen((current) => !current)}
          className={cx(controlClasses, "flex items-center justify-between gap-2 text-left", open && "border-focus-ring", error && "border-2 border-status-danger")}
        >
          <span className={shown ? undefined : "text-ink-muted"}>{shown ?? placeholder}</span>
          <Icon name="calendar" size={20} className="text-ink-muted" />
        </button>
      </Field>
      {name && <input type="hidden" name={name} value={date ?? ""} />}
      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              button.current?.focus();
            }
          }}
          className="absolute top-full left-0 z-[60] mt-1.5"
        >
          <Calendar
            {...calendar}
            value={date}
            onChange={set}
            autoFocus
            className="elevation-md"
            footer={
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => set(todayIn(calendar.timeZone))}>
                  Today
                </Button>
                {!required && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set(null)}>
                    Clear
                  </Button>
                )}
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
