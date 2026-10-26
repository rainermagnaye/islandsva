"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { convertWallClock, todayIn } from "@/components/ui/date-math";
import { Form } from "@/components/ui/form";
import { saveDiscoveryTimesAction } from "../actions";
import { DISCOVERY_LIMITS, DISCOVERY_TIME_OPTIONS, DISCOVERY_ZONE, timeLabel, type DiscoveryTimesField } from "../contract";

const GROUPS = [
  { label: "Morning", from: "06:00", to: "11:30" },
  { label: "Afternoon", from: "12:00", to: "17:30" },
  { label: "Evening", from: "18:00", to: "23:30" },
  { label: "Night", from: "00:00", to: "05:30" },
] as const;

// The browser's zone exists only after hydration: the server snapshot is null, so nothing zone-specific renders
// on the server and the first client render matches it.
const noSubscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => null;

/**
 * "Discovery calls" settings: up to six daily times in Philippine time, as native checkboxes. The admin sees how
 * many are chosen and, outside Manila, the same times in their own zone.
 */
export function DiscoveryTimesForm({ saved }: { saved: readonly string[] }) {
  const hintId = useId();
  const errorId = useId();
  const [chosen, setChosen] = useState<readonly string[]>(saved);
  const zone = useSyncExternalStore(noSubscribe, browserZone, serverZone);

  function track(event: FormEvent<HTMLFieldSetElement>) {
    const boxes = event.currentTarget.querySelectorAll<HTMLInputElement>('input[name="times"]:checked');
    setChosen(Array.from(boxes, (box) => box.value));
  }

  const today = zone ? todayIn(DISCOVERY_ZONE) : null;
  const local =
    zone && today && zone !== DISCOVERY_ZONE && chosen.length > 0
      ? chosen.map((time) => {
          const there = convertWallClock(`${today}T${time}`, DISCOVERY_ZONE, zone);
          const shift = there.date < today ? " (day before)" : there.date > today ? " (next day)" : "";
          return `${timeLabel(there.time)}${shift}`;
        })
      : null;

  return (
    <Form<DiscoveryTimesField> aria-label="Discovery call times" onSubmit={saveDiscoveryTimesAction} className="gap-4">
      {({ pending, fieldErrors }) => (
        <>
          <fieldset
            className="m-0 grid gap-3 border-0 p-0"
            aria-describedby={fieldErrors.times ? `${errorId} ${hintId}` : hintId}
            onChange={track}
          >
            <legend className="mb-1 type-label text-ink">Daily times (Philippine time)</legend>
            <p id={hintId} className="m-0 type-body-sm text-ink-muted" aria-live="polite">
              {chosen.length} of {DISCOVERY_LIMITS.maxTimes} chosen. Each call is {DISCOVERY_LIMITS.callMinutes} minutes.
            </p>
            {GROUPS.map((group) => (
              <div key={group.label} className="grid gap-1.5">
                <p className="m-0 type-body-sm font-semibold text-ink">{group.label}</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                  {DISCOVERY_TIME_OPTIONS.filter((time) => time >= group.from && time <= group.to).map((time) => (
                    <label
                      key={time}
                      className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-1 type-body-sm text-ink has-[:checked]:border-action-secondary has-[:checked]:bg-status-info-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring"
                    >
                      <input
                        type="checkbox"
                        name="times"
                        value={time}
                        defaultChecked={saved.includes(time)}
                        aria-invalid={fieldErrors.times ? true : undefined}
                        className="size-4"
                      />
                      {timeLabel(time)}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {local && (
              <p className="m-0 type-body-sm text-ink-muted">
                In your time ({zone}): {local.join(", ")}
              </p>
            )}
            {fieldErrors.times && (
              <p id={errorId} className="m-0 type-label text-status-danger">
                {fieldErrors.times}
              </p>
            )}
          </fieldset>
          <div>
            <Button type="submit" variant="secondary" size="md" loading={pending}>
              {pending ? "Saving" : "Save times"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
