"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clockLabel } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { cx } from "@/lib/cx";
import { bookVaTaskAction } from "../actions";
import { TASK_LIMITS, VA_BLOCK_LENGTHS, type VaTaskField } from "../contract";

type Choice = { id: string; label: string };
type Mode = "new" | "block";

const START_TIMES = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return { value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`, label: clockLabel(minutes) };
});

function lengthLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

const MODES: readonly { value: Mode; label: string; hint: string }[] = [
  { value: "new", label: "New task", hint: "For a client, or a to-do of your own" },
  { value: "block", label: "Block time on a task", hint: "Set aside time for one of your open tasks" },
];

/**
 * "Book › Task" on the VA calendar: a new task (for a client, who sees it in their list, or a to-do with no client)
 * or time set aside on one of the VA's open tasks. Either way it shows on the calendar at the chosen time.
 */
export function VaTaskForm({ clients, tasks, today, last, onDone }: { clients: readonly Choice[]; tasks: readonly Choice[]; today: string; last: string; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("new");
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [minutes, setMinutes] = useState("60");
  const end = clockLabel((Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + Number(minutes)) % 1440);
  const client = clients.find((item) => item.id === clientId);

  return (
    <Form<VaTaskField>
      aria-label="Book a task"
      className="gap-4"
      onSubmit={async (formData) => {
        const result = await bookVaTaskAction(formData);
        if (result.ok) onDone?.();
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-2 type-label text-ink">What kind</legend>
            {MODES.map((item) => (
              <label
                key={item.value}
                className={cx(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border p-3",
                  mode === item.value ? "border-action-secondary bg-status-info-bg" : "border-border",
                )}
              >
                <input type="radio" name="mode" value={item.value} checked={mode === item.value} onChange={() => setMode(item.value)} className="mt-0.5 size-4" />
                <span className="grid gap-0.5">
                  <span className="type-label text-ink">{item.label}</span>
                  <span className="type-body-sm text-ink-muted">{item.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {mode === "new" ? (
            <>
              <TextField label="Title" name="title" required maxLength={TASK_LIMITS.title} error={fieldErrors.title} />
              <Select
                label="Client"
                name="clientId"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                options={[{ value: "", label: "No client (my own to-do)" }, ...clients.map((item) => ({ value: item.id, label: item.label }))]}
                hint={client ? `${client.label} sees this task in their list and reviews it when you submit.` : "Leave it as your own to-do: only you see it, on your calendar."}
                error={fieldErrors.clientId}
              />
              {client && <TextField label="Details" name="description" multiline rows={3} optional maxLength={TASK_LIMITS.description} error={fieldErrors.description} />}
            </>
          ) : tasks.length === 0 ? (
            <p className="m-0 type-body-sm text-ink-muted">You have no open tasks. Add a new task instead.</p>
          ) : (
            <Select label="Task" name="taskId" required placeholder="Choose a task" options={tasks.map((item) => ({ value: item.id, label: item.label }))} hint="Your open tasks, soonest deadline first." error={fieldErrors.taskId} />
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]">
            <DatePicker label="Date" name="date" required min={today} max={last} value={date} onChange={(next) => next && setDate(next)} timeZone="Asia/Manila" error={fieldErrors.date} />
            <Select label="Starts (Manila)" name="startTime" value={start} onChange={(event) => setStart(event.target.value)} options={START_TIMES} error={fieldErrors.startTime} />
            <Select
              label={mode === "new" ? "Time needed" : "Length"}
              name="minutes"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              options={VA_BLOCK_LENGTHS.map((value) => ({ value: String(value), label: lengthLabel(value) }))}
              error={fieldErrors.minutes}
            />
          </div>
          <p className="m-0 type-body-sm text-ink-muted">
            On your calendar {clockLabel(Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)))} – {end}.
            {mode === "new" && client ? " The task is due when this time ends. Hours count only while its timer runs." : ""}
          </p>

          <div className="flex justify-end">
            <Button type="submit" iconLeft={mode === "new" ? "plus" : "clock"} loading={pending} disabled={mode === "block" && tasks.length === 0}>
              {pending ? "Saving" : mode === "block" ? "Block time" : client ? "Add task" : "Add to-do"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
