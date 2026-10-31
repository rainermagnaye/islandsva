"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { todayIn, wallClockIn, type IsoDate } from "@/components/ui/date-math";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeSlotPicker } from "@/components/ui/time-slot-picker";
import { DISCOVERY_ZONE } from "@/features/meetings/contract";
import { fetchDiscoverySlots } from "../api-client";

type Loaded = { key: number; today: IsoDate; result: Awaited<ReturnType<typeof fetchDiscoverySlots>> };

type DiscoveryTimeStepProps = {
  /** The visitor's zone (from their country): days and times are shown in it, Philippine time under each. */
  timeZone: string;
  /** Bump it to load the open times again, e.g. after the picked one was taken. */
  reloadKey: number;
  onRetry: () => void;
  /** How many times are open once loaded: with none, the form sends a plain enquiry instead. */
  onLoaded: (count: number) => void;
  error?: string;
};

/**
 * The contact form's last step: a calendar of the days with open discovery-call times (the rest can't be
 * picked), then that day's times. The checked radio posts the slot's UTC instant as `startsAt`; the server
 * books only a time that is still open. Loaded with next/dynamic, so the calendar stays off the page's first load.
 */
export function DiscoveryTimeStep({ timeZone, reloadKey, onRetry, onLoaded, error }: DiscoveryTimeStepProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [day, setDay] = useState<IsoDate | null>(null);

  useEffect(() => {
    let live = true;
    fetchDiscoverySlots().then((result) => {
      if (!live) return;
      // Read the clock here, not while rendering: "today" decides which calendar day is marked.
      setLoaded({ key: reloadKey, today: todayIn(timeZone), result });
      if (result.ok) onLoaded(result.slots.length);
    });
    return () => {
      live = false;
    };
  }, [reloadKey, timeZone, onLoaded]);

  const current = loaded?.key === reloadKey ? loaded : null;
  if (!current) {
    return (
      <div aria-busy="true" className="grid gap-3">
        <p className="m-0 type-body-sm text-ink-muted">Loading open times…</p>
        <Skeleton variant="rect" height={280} />
      </div>
    );
  }

  if (!current.result.ok) {
    return (
      <Alert
        tone="danger"
        title={current.result.message}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  const slots = current.result.slots.map((start) => ({ start: wallClockIn(start, timeZone), value: start }));
  if (slots.length === 0) {
    return (
      <>
        <input type="hidden" name="startsAt" value="" />
        <Alert tone="info" title="No call times are open right now">
          Send your details and we&apos;ll email you to set up a time.
        </Alert>
      </>
    );
  }

  const days = [...new Set(slots.map((slot) => slot.start.slice(0, 10)))];
  // A day that lost its last time on reload falls back to the first day still open.
  const shown = day && days.includes(day) ? day : days[0];
  const daySlots = slots.filter((slot) => slot.start.startsWith(shown));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Calendar
        value={shown}
        onChange={setDay}
        min={days[0]}
        max={days.at(-1)}
        defaultMonth={days[0]}
        isDateDisabled={(date) => !days.includes(date)}
        today={current.today}
      />
      <div className="grid gap-2">
        <TimeSlotPicker key={`${shown}-${reloadKey}`} date={shown} timeZone={timeZone} otherTimeZone={DISCOVERY_ZONE} name="startsAt" slots={daySlots} />
        {error && <p className="m-0 type-label text-status-danger">{error}</p>}
      </div>
    </div>
  );
}
