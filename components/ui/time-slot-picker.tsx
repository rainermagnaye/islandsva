"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/cx";
import { convertWallClock, formatDate, minutesOf, clockLabel, partOfDay, type IsoDate, type IsoLocalDateTime } from "./date-math";
import { EmptyState } from "./empty-state";
import { Icon } from "./icon";

type Slot = IsoLocalDateTime | { start: IsoLocalDateTime; available?: boolean };

type TimeSlotPickerProps = {
  /** Wall-clock times written in `timeZone`; `{ start, available: false }` for booked ones. Generate them on the server. */
  slots: readonly Slot[];
  /** The zone the slots are written in, usually the client's. Default Asia/Manila. */
  timeZone?: string;
  /** Also print each time in this zone, usually Asia/Manila. */
  otherTimeZone?: string;
  date?: IsoDate;
  label?: string;
  value?: IsoLocalDateTime | null;
  onChange?: (start: IsoLocalDateTime) => void;
  /** For forms: the radio group's name; the checked value is the slot's start. */
  name?: string;
  className?: string;
};

const GROUPS = [
  { id: "morning", label: "Morning", icon: "sun" },
  { id: "afternoon", label: "Afternoon", icon: "sun" },
  { id: "evening", label: "Evening", icon: "moon" },
] as const;

const zoneName = (zone: string) => zone.split("/").pop()?.replace(/_/g, " ") ?? zone;

/**
 * Bookable times for one day in the client's zone, with the other side of the world under each. A real radio
 * group (arrow keys move), 52px tiles, grouped by part of day; booked times are struck through. Re-check the
 * slot when the booking is submitted: it may have been taken.
 */
export function TimeSlotPicker({ slots, timeZone = "Asia/Manila", otherTimeZone, date, label, value, onChange, name, className }: TimeSlotPickerProps) {
  const id = useId();
  const [inner, setInner] = useState<IsoLocalDateTime | null>(null);
  const chosen = value === undefined ? inner : value;
  const normal = slots.map((slot) => (typeof slot === "string" ? { start: slot, available: true } : { start: slot.start, available: slot.available !== false }));
  const title = label ?? (date ? formatDate(date, { weekday: "long", month: "long", day: "numeric" }) : "Pick a time");

  if (!normal.some((slot) => slot.available)) {
    return <EmptyState compact title="No times left that day" description="Please pick another date." />;
  }

  return (
    <fieldset className={cx("m-0 grid min-w-0 gap-4 border-0 p-0", className)}>
      <legend className="mb-1 w-full p-0 type-body-md font-semibold text-ink">{title}</legend>
      <p className="m-0 flex items-start gap-2 type-body-sm text-ink-muted">
        <Icon name="globe" size={16} className="mt-0.5 shrink-0" />
        <span>
          Times in <b className="font-semibold text-ink">{zoneName(timeZone)}</b>
          {otherTimeZone && otherTimeZone !== timeZone ? ` · ${zoneName(otherTimeZone)} shown below each time` : ""}
        </span>
      </p>
      {GROUPS.map((group) => {
        const inGroup = normal.filter((slot) => partOfDay(slot.start) === group.id);
        if (inGroup.length === 0) return null;
        return (
          <div key={group.id} className="grid gap-2">
            <p className="m-0 flex items-center gap-1.5 type-eyebrow text-ink-muted">
              <Icon name={group.icon} size={15} />
              {group.label}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
              {inGroup.map((slot) => {
                const other = otherTimeZone && otherTimeZone !== timeZone ? convertWallClock(slot.start, timeZone, otherTimeZone) : null;
                const inputId = `${id}-${slot.start}`;
                return (
                  <div key={slot.start} className="relative">
                    <input
                      id={inputId}
                      type="radio"
                      name={name ?? id}
                      value={slot.start}
                      disabled={!slot.available}
                      checked={chosen === slot.start}
                      onChange={() => {
                        setInner(slot.start);
                        onChange?.(slot.start);
                      }}
                      className="peer absolute inset-0 m-0 opacity-0"
                    />
                    <label
                      htmlFor={inputId}
                      className="grid min-h-13 cursor-pointer content-center justify-items-center gap-px rounded-md border-control border-border-strong bg-surface-card px-2 py-1.5 text-ink transition-colors peer-checked:border-action-secondary peer-checked:bg-action-secondary peer-checked:text-on-action-secondary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring peer-disabled:cursor-not-allowed peer-disabled:border-transparent peer-disabled:bg-disabled-fill peer-disabled:text-disabled-ink peer-disabled:line-through hover:border-action-secondary hover:bg-action-ghost-hover"
                    >
                      <span className="type-button tabular-nums">{clockLabel(minutesOf(slot.start))}</span>
                      {other && <span className="type-caption opacity-80">{clockLabel(minutesOf(other.time))} {zoneName(otherTimeZone ?? "")}</span>}
                      {!slot.available && <span className="sr-only">(booked)</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
