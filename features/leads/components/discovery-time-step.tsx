"use client";

import { useId, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { addDays, clockLabel, convertWallClock, formatDate, instantInZone, minutesOf, todayIn, wallClockIn, zoneCity, type IsoDate } from "@/components/ui/date-math";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { DISCOVERY_TIME_OPTIONS, DISCOVERY_WINDOW_DAYS, DISCOVERY_ZONE, inDiscoveryWindow } from "@/features/meetings/contract";

type DiscoveryTimeStepProps = {
  /** The visitor's zone (from their country): days and times are shown in it, Philippine time beside it. */
  timeZone: string;
  /** Whether a time that can be booked is chosen now. */
  onPickedChange: (picked: boolean) => void;
  error?: string;
};

type Period = "am" | "pm";
type Minute = "00" | "30";
type Choice = { hour: number | null; minute: Minute; period: Period };

/**
 * Every half hour in `timeZone` from 12 hours to 90 days ahead, keyed by local day ("2026-11-04") and then
 * local time ("09:30") → the UTC instant the form posts. Built from local times so a zone like Nepal's
 * (UTC+5:45) still gets :00 and :30.
 */
function openStarts(timeZone: string, now: number) {
  const today = todayIn(timeZone, new Date(now));
  const byDay = new Map<IsoDate, Map<string, string>>();
  for (let day = 0; day <= DISCOVERY_WINDOW_DAYS + 1; day++) {
    const date = addDays(today, day);
    for (const time of DISCOVERY_TIME_OPTIONS) {
      const value = instantInZone(date, time, timeZone);
      if (!inDiscoveryWindow(Date.parse(value), now)) continue;
      // A time skipped by a daylight-saving change lands on another wall clock; file it where it really falls.
      const local = wallClockIn(value, timeZone);
      const times = byDay.get(local.slice(0, 10)) ?? new Map<string, string>();
      times.set(local.slice(11, 16), value);
      byDay.set(local.slice(0, 10), times);
    }
  }
  return byDay;
}

/** "09:30" from the 12-hour parts. */
const time24 = (hour: number, minute: Minute, period: Period) => `${String((hour % 12) + (period === "pm" ? 12 : 0)).padStart(2, "0")}:${minute}`;

const periodOf = (time: string): Period => (Number(time.slice(0, 2)) >= 12 ? "pm" : "am");

/**
 * Keeps a choice bookable on `times` where it can: the other period when this one has nothing open (today's
 * mornings may all be too soon), then the other half hour of the same hour, else no hour (the visitor picks again).
 */
function settle(choice: Choice, times: Map<string, string>): Choice {
  const open = [...times.keys()].some((time) => periodOf(time) === choice.period);
  const next = open ? choice : { ...choice, period: choice.period === "am" ? ("pm" as const) : ("am" as const) };
  if (next.hour === null || times.has(time24(next.hour, next.minute, next.period))) return next;
  const other: Minute = next.minute === "00" ? "30" : "00";
  if (times.has(time24(next.hour, other, next.period))) return { ...next, minute: other };
  return { ...next, hour: null };
}

/**
 * The contact form's last step: a calendar of the next 90 days (earlier days can't be picked), then a time on that day in the visitor's zone
 * (hour, :00 or :30, am or pm), with Philippine time beside it. Times less than 12 hours away can't be chosen.
 * A hidden `startsAt` posts the UTC instant; the server checks the window again and refuses a start someone
 * else already requested. Loaded with next/dynamic, so it stays off the page's first load.
 */
export function DiscoveryTimeStep({ timeZone, onPickedChange, error }: DiscoveryTimeStepProps) {
  const id = useId();
  // Read the clock once, when the step opens (not on every render): it decides which days and times are offered.
  const [now] = useState(() => Date.now());
  const [day, setDay] = useState<IsoDate | null>(null);
  const [choice, setChoice] = useState<Choice>({ hour: null, minute: "00", period: "am" });

  // About 4,300 half hours: build them once per zone, not on every pick.
  const byDay = useMemo(() => openStarts(timeZone, now), [timeZone, now]);
  const days = [...byDay.keys()];
  const shown = day && byDay.has(day) ? day : days[0];
  const times = byDay.get(shown) ?? new Map<string, string>();

  const periodOpen = (period: Period) => [...times.keys()].some((time) => periodOf(time) === period);
  const current = settle(choice, times);
  const startsAt = current.hour === null ? null : (times.get(time24(current.hour, current.minute, current.period)) ?? null);

  function choose(next: Partial<Choice>, on = times) {
    const settled = settle({ ...current, ...next }, on);
    setChoice(settled);
    onPickedChange(settled.hour !== null && on.has(time24(settled.hour, settled.minute, settled.period)));
  }

  const hourOpen = (hour: number) => times.has(time24(hour, "00", current.period)) || times.has(time24(hour, "30", current.period));
  const local = startsAt ? wallClockIn(startsAt, timeZone) : null;
  const manila = local && timeZone !== DISCOVERY_ZONE ? convertWallClock(local, timeZone, DISCOVERY_ZONE) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Calendar
        value={shown}
        onChange={(date) => {
          setDay(date);
          choose({}, byDay.get(date) ?? new Map());
        }}
        min={days[0]}
        max={days.at(-1)}
        defaultMonth={days[0]}
        isDateDisabled={(date) => !byDay.has(date)}
        today={todayIn(timeZone, new Date(now))}
      />

      <div className="grid content-start gap-4">
        <div className="grid gap-1">
          <p className="m-0 type-body-md font-semibold text-ink">{formatDate(shown, { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="m-0 flex items-start gap-2 type-body-sm text-ink-muted">
            <Icon name="globe" size={16} className="mt-0.5 shrink-0" />
            <span>
              Times in <b className="font-semibold text-ink">{zoneCity(timeZone)}</b>, at least 12 hours from now
            </span>
          </p>
        </div>

        {/* Wraps instead of squeezing: the column beside the calendar is narrow on mid-size screens. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Select
            label="Hour"
            name="callHour"
            placeholder="Hour"
            value={current.hour === null ? "" : String(current.hour)}
            onChange={(event) => choose({ hour: Number(event.target.value) })}
            options={Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => ({ value: String(hour), label: String(hour), disabled: !hourOpen(hour) }))}
            />
          </div>
          <Segments
            legend="Minutes"
            name={`${id}-minute`}
            value={current.minute}
            options={(["00", "30"] as const).map((minute) => ({
              value: minute,
              label: `:${minute}`,
              disabled: current.hour !== null && !times.has(time24(current.hour, minute, current.period)),
            }))}
            onChange={(minute) => choose({ minute })}
          />
          <Segments
            legend="AM or PM"
            name={`${id}-period`}
            value={current.period}
            options={(["am", "pm"] as const).map((value) => ({ value, label: value.toUpperCase(), disabled: !periodOpen(value) }))}
            onChange={(value) => choose({ period: value })}
          />
        </div>

        <input type="hidden" name="startsAt" value={startsAt ?? ""} />
        <p className="m-0 flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2.5 type-body-sm text-ink" aria-live="polite">
          <Icon name="clock" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
          {local ? (
            <span>
              <b className="font-semibold">{clockLabel(minutesOf(local))}</b> in {zoneCity(timeZone)}
              {manila && <span className="text-ink-muted"> · {clockLabel(minutesOf(manila.time))} in Manila</span>}
            </span>
          ) : (
            <span className="text-ink-muted">Choose an hour to see your call time.</span>
          )}
        </p>
        {error && <p className="m-0 type-label text-status-danger">{error}</p>}
      </div>
    </div>
  );
}

type SegmentsProps<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
};

/** Two or three choices side by side as one radio group (arrow keys move), the size of a form control. */
function Segments<T extends string>({ legend, name, value, options, onChange }: SegmentsProps<T>) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 type-label text-ink">{legend}</legend>
      <div className="flex">
        {options.map((option, index) => (
          <div key={option.value} className="relative flex-1">
            <input
              id={`${name}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="peer absolute inset-0 m-0 opacity-0"
            />
            <label
              htmlFor={`${name}-${option.value}`}
              className={`grid min-h-11 min-w-14 cursor-pointer place-items-center border-control border-border-strong bg-surface-card px-3 type-button tabular-nums text-ink transition-colors peer-checked:border-action-secondary peer-checked:bg-action-secondary peer-checked:text-on-action-secondary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring peer-disabled:cursor-not-allowed peer-disabled:bg-disabled-fill peer-disabled:text-disabled-ink hover:bg-action-ghost-hover ${index === 0 ? "rounded-l-md" : "-ml-px"} ${index === options.length - 1 ? "rounded-r-md" : ""}`}
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
