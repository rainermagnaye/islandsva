"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { TextField } from "@/components/ui/text-field";

/** The date and the time of a deadline. The time is a wall clock in the company's zone. */
export function DeadlineFields({
  today,
  last,
  timeZone,
  deadline,
  deadlineTime,
  dateError,
  timeError,
}: {
  today: string;
  last: string;
  timeZone: string;
  deadline?: string;
  deadlineTime?: string | null;
  dateError?: string;
  timeError?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DatePicker
        label="Task deadline"
        name="deadline"
        required
        min={today || undefined}
        max={last || undefined}
        timeZone={timeZone}
        defaultValue={deadline ?? (today || undefined)}
        error={dateError}
      />
      <TextField label="Deadline time" name="deadlineTime" type="time" required step={60} defaultValue={deadlineTime ?? undefined} error={timeError} />
    </div>
  );
}
