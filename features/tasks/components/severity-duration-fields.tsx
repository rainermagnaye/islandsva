"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { TASK_DURATION, TASK_SEVERITIES, TASK_SEVERITY_LABELS, type TaskSeverity } from "../contract";
import { defaultDuration, formatMinutes } from "../time";

const HOURS = Array.from({ length: TASK_DURATION.max / 60 + 1 }, (_, hours) => ({ value: String(hours), label: hours === 1 ? "1 hour" : `${hours} hours` }));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);

/**
 * Severity and duration. The severity sets the duration (low 30 min, medium 1 h, high 2 h) until the client picks
 * a duration of their own; after that, changing the severity leaves their duration alone.
 */
export function SeverityDurationFields({
  severity,
  durationMinutes,
  severityError,
  hoursError,
  minutesError,
}: {
  severity?: TaskSeverity;
  durationMinutes?: number;
  severityError?: string;
  hoursError?: string;
  minutesError?: string;
}) {
  const startSeverity = severity ?? "medium";
  const [level, setLevel] = useState<TaskSeverity>(startSeverity);
  const [total, setTotal] = useState(durationMinutes ?? defaultDuration(startSeverity));
  const [custom, setCustom] = useState(durationMinutes !== undefined && durationMinutes !== defaultDuration(startSeverity));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  // A stored value off the 5-minute steps (none today) still shows as itself.
  const minuteOptions = (MINUTE_STEPS.includes(minutes) ? MINUTE_STEPS : [...MINUTE_STEPS, minutes].sort((a, b) => a - b)).map((value) => ({
    value: String(value),
    label: `${value} min`,
  }));

  return (
    <div className="grid gap-4">
      <Select
        label="Severity"
        name="severity"
        required
        value={level}
        onChange={(event) => {
          const next = event.target.value as TaskSeverity;
          setLevel(next);
          if (!custom) setTotal(defaultDuration(next));
        }}
        options={TASK_SEVERITIES.map((value) => ({ value, label: `${TASK_SEVERITY_LABELS[value]} · ${formatMinutes(defaultDuration(value))}` }))}
        hint="Sets the starting duration. You can change it below."
        error={severityError}
      />
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 p-0 type-label text-ink">Duration</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Hours"
            name="durationHours"
            value={String(hours)}
            onChange={(event) => {
              setCustom(true);
              setTotal(Number(event.target.value) * 60 + minutes);
            }}
            options={HOURS}
            error={hoursError}
          />
          <Select
            label="Minutes"
            name="durationMinutes"
            value={String(minutes)}
            onChange={(event) => {
              setCustom(true);
              setTotal(hours * 60 + Number(event.target.value));
            }}
            options={minuteOptions}
            error={minutesError}
          />
        </div>
        <p className="m-0 type-body-sm text-ink-muted">
          {formatMinutes(total)} of work. Your VA&apos;s timer runs against it, and time past it shows as Delayed. From {TASK_DURATION.min} minutes to{" "}
          {TASK_DURATION.max / 60} hours.
        </p>
      </fieldset>
    </div>
  );
}
