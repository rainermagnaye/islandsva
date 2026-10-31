"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { cx } from "@/lib/cx";
import { addDemoSlots } from "../actions";
import type { SlotField } from "../contract";
import { slotCells, slotLabel, workingTimes, type BusyTime, type SlotCell } from "../slot-times";

const PARTS: readonly { name: string; from: number; to: number }[] = [
  { name: "Night", from: 0, to: 6 },
  { name: "Morning", from: 6, to: 12 },
  { name: "Afternoon", from: 12, to: 18 },
  { name: "Evening", from: 18, to: 24 },
];
const hourOf = (time: string) => Number(time.slice(0, 2));
const TAG: Record<Exclude<SlotCell["state"], "free">, string> = { offered: "Offered", booked: "Booked", past: "Past" };

/**
 * "Add demo slots": a day and the half hours a VA can take a demo, in Manila time. Times already offered, past,
 * or overlapping a meeting or demo call are locked, with the reason on hover and for screen readers. The server
 * checks the bookings again on save.
 */
export function AddSlotsForm({
  today,
  last,
  busy,
  offered,
  windows,
  onAdded,
}: {
  today: string;
  last: string;
  busy: readonly BusyTime[];
  /** ISO starts of the VA's existing slots. */
  offered: readonly string[];
  windows: readonly { weekday: number; startMinute: number; endMinute: number }[];
  onAdded?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const cells = useMemo(() => slotCells(date, offered, busy, new Date()), [date, offered, busy]);
  const fill = workingTimes(cells, date, windows);
  const free = new Set(cells.filter((cell) => cell.state === "free").map((cell) => cell.time));
  // A time that became locked after a refresh (someone booked it) drops out of the choice.
  const picked = [...chosen].filter((time) => free.has(time));

  function toggle(time: string, on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(time);
      else next.delete(time);
      return next;
    });
  }

  return (
    <Form<SlotField>
      aria-label="Add demo slots"
      onSubmit={async (formData) => {
        const result = await addDemoSlots(formData);
        if (result.ok) {
          setChosen(new Set());
          onAdded?.();
        }
        return result;
      }}
      className="gap-4"
    >
      {({ pending, fieldErrors }) => (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-60 max-w-full">
              <DatePicker
                label="Date"
                name="date"
                required
                min={today}
                max={last}
                value={date}
                onChange={(next) => {
                  if (next) setDate(next);
                  setChosen(new Set());
                }}
                timeZone="Asia/Manila"
                error={fieldErrors.date}
              />
            </div>
            <Button type="button" variant="ghost" iconLeft="clock" disabled={fill.length === 0} onClick={() => setChosen(new Set(fill))}>
              Fill from my working hours
            </Button>
          </div>

          <ul aria-label="What the times mean" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 type-caption text-ink-muted">
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-sm border border-border bg-surface-card" /> Free
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-sm border border-action-secondary bg-status-info-bg" /> New slot
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-sm border border-border bg-disabled-fill" /> Offered or past
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-sm border border-status-danger bg-status-danger-bg" /> Booked
            </li>
          </ul>

          <fieldset className="m-0 grid gap-3 border-0 p-0" aria-describedby={fieldErrors.times ? "times-error" : undefined}>
            <legend className="mb-1 type-label text-ink">Start times (Manila)</legend>
            {PARTS.map((part) => (
              <div key={part.name} className="grid gap-1.5">
                <span className="type-caption font-semibold text-ink-muted">{part.name}</span>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {cells
                    .filter((cell) => hourOf(cell.time) >= part.from && hourOf(cell.time) < part.to)
                    .map((cell) => {
                      const locked = cell.state !== "free";
                      return (
                        <label
                          key={cell.time}
                          title={cell.reason ?? undefined}
                          className={cx(
                            "flex min-h-11 flex-col items-center justify-center rounded-md border px-1 py-0.5 type-body-sm",
                            cell.state === "booked" && "cursor-not-allowed border-status-danger bg-status-danger-bg text-ink-muted line-through",
                            (cell.state === "offered" || cell.state === "past") && "cursor-not-allowed border-border bg-disabled-fill text-disabled-ink",
                            !locked && "cursor-pointer border-border text-ink has-[:checked]:border-action-secondary has-[:checked]:bg-status-info-bg",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              name="times"
                              value={cell.time}
                              disabled={locked || pending}
                              checked={locked ? cell.state === "offered" : picked.includes(cell.time)}
                              onChange={(event) => toggle(cell.time, event.target.checked)}
                              className="size-4"
                            />
                            {slotLabel(cell.time)}
                          </span>
                          {cell.reason && <span className="sr-only">{cell.reason}</span>}
                          {cell.state !== "free" && <span className={cx("type-caption font-semibold no-underline", cell.state === "booked" ? "text-status-danger" : "")}>{TAG[cell.state]}</span>}
                        </label>
                      );
                    })}
                </div>
              </div>
            ))}
            {fieldErrors.times && (
              <p id="times-error" className="m-0 type-label text-status-danger">
                {fieldErrors.times}
              </p>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 type-body-sm text-ink-muted">
              {picked.length === 0 ? "Pick the times you can take a call." : `${picked.length} new ${picked.length === 1 ? "slot" : "slots"} selected.`} Clients book at least 4 hours ahead.
            </p>
            <Button type="submit" iconLeft="plus" loading={pending} disabled={picked.length === 0}>
              {pending ? "Adding" : picked.length > 1 ? `Add ${picked.length} slots` : "Add slot"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
