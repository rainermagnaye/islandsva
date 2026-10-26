"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { addDemoSlots } from "../actions";
import { SLOT_TIMES, type SlotField } from "../contract";

/**
 * "Add slots": a day and the half hours a VA can take a demo, in Manila time. Native inputs only; times already
 * offered that day are kept as they are.
 */
export function AddSlotsForm({ today, last }: { today: string; last: string }) {
  return (
    <Form<SlotField> aria-label="Add slots" onSubmit={addDemoSlots} className="gap-4">
      {({ pending, fieldErrors }) => (
        <>
          <div className="max-w-60">
            <DatePicker label="Date" name="date" required min={today} max={last} defaultValue={today} timeZone="Asia/Manila" error={fieldErrors.date} />
          </div>
          <fieldset className="m-0 grid gap-2 border-0 p-0" aria-describedby={fieldErrors.times ? "times-error" : "times-hint"}>
            <legend className="mb-2 type-label text-ink">Start times (Manila)</legend>
            <p id="times-hint" className="m-0 type-body-sm text-ink-muted">
              Each slot is 30 minutes. Clients see it in their own time zone.
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
              {SLOT_TIMES.map((time) => (
                <label
                  key={time}
                  className="flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-1 type-body-sm text-ink has-[:checked]:border-action-secondary has-[:checked]:bg-status-info-bg"
                >
                  <input type="checkbox" name="times" value={time} aria-invalid={fieldErrors.times ? true : undefined} className="size-4" />
                  {time}
                </label>
              ))}
            </div>
            {fieldErrors.times && (
              <p id="times-error" className="m-0 type-label text-status-danger">
                {fieldErrors.times}
              </p>
            )}
          </fieldset>
          <div>
            <Button type="submit" variant="secondary" size="sm" iconLeft="plus" loading={pending}>
              {pending ? "Adding" : "Add slots"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
