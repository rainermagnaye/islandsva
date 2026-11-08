"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clockLabel } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import { bookVaTaskAction } from "../actions";
import { TASK_LIMITS, VA_BLOCK_LENGTHS, type VaTaskField } from "../contract";

const START_TIMES = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return { value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`, label: clockLabel(minutes) };
});

function lengthLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * "Book › Task" on the staff calendar: a to-do of their own, shown only on their calendar at the chosen time.
 */
export function VaTaskForm({
  today,
  last,
  onDone,
  book = bookVaTaskAction,
  defaultDate,
  startTime = "09:00",
}: {
  today: string;
  last: string;
  onDone?: () => void;
  book?: (formData: FormData) => Promise<SubmitResult<VaTaskField>>;
  defaultDate?: string;
  startTime?: string;
}) {
  const [date, setDate] = useState(defaultDate ?? today);
  const [start, setStart] = useState(startTime);
  const [minutes, setMinutes] = useState("60");
  const end = clockLabel((Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + Number(minutes)) % 1440);

  return (
    <Form<VaTaskField>
      aria-label="Book a task"
      className="gap-4"
      onSubmit={async (formData) => {
        const result = await book(formData);
        if (result.ok) onDone?.();
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="mode" value="new" />
          <TextField label="Title" name="title" required maxLength={TASK_LIMITS.title} error={fieldErrors.title} />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]">
            <DatePicker label="Date" name="date" required min={today} max={last} value={date} onChange={(next) => next && setDate(next)} timeZone="Asia/Manila" error={fieldErrors.date} />
            <Select label="Starts (Manila)" name="startTime" value={start} onChange={(event) => setStart(event.target.value)} options={START_TIMES} error={fieldErrors.startTime} />
            <Select
              label="Time needed"
              name="minutes"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              options={VA_BLOCK_LENGTHS.map((value) => ({ value: String(value), label: lengthLabel(value) }))}
              error={fieldErrors.minutes}
            />
          </div>
          <p className="m-0 type-body-sm text-ink-muted">
            On your calendar {clockLabel(Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)))} – {end}. Only you see this.
          </p>

          <div className="flex justify-end">
            <Button type="submit" iconLeft="plus" loading={pending}>
              {pending ? "Saving" : "Add to-do"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
