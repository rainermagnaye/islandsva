"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { bookDemoAction } from "../booking-actions";
import { DEMO_LIMITS, type BookField } from "../contract";

export type TimeGroup = { day: string; times: { slotId: string; label: string }[] };

/**
 * "Book a demo": open times grouped by day in the client's time zone (formatted on the server), picked with
 * native radio buttons, plus an optional note for the VA.
 */
export function BookDemoForm({ groups, zoneLabel }: { groups: readonly TimeGroup[]; zoneLabel: string }) {
  return (
    <Form<BookField> aria-label="Book a demo call" onSubmit={bookDemoAction} className="gap-5">
      {({ pending, fieldErrors }) => (
        <>
          <fieldset className="m-0 grid gap-4 border-0 p-0" aria-describedby={fieldErrors.slotId ? "slot-error" : "slot-hint"}>
            <legend className="mb-1 type-label text-ink">Pick a time</legend>
            <p id="slot-hint" className="m-0 type-body-sm text-ink-muted">
              Times are in {zoneLabel}. Each call is 30 minutes.
            </p>
            {groups.map((group) => (
              <div key={group.day} className="grid gap-2">
                <p className="m-0 type-body-sm text-ink-muted">{group.day}</p>
                <div className="flex flex-wrap gap-2">
                  {group.times.map((time) => (
                    <label
                      key={time.slotId}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 type-body-sm text-ink has-[:checked]:border-action-secondary has-[:checked]:bg-status-info-bg"
                    >
                      <input type="radio" name="slotId" value={time.slotId} required />
                      {time.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {fieldErrors.slotId && (
              <p id="slot-error" className="m-0 type-label text-status-danger">
                {fieldErrors.slotId}
              </p>
            )}
          </fieldset>
          <TextField
            label="Anything your VA should know?"
            name="note"
            multiline
            optional
            maxLength={DEMO_LIMITS.note}
            hint="For example the tasks you'd like help with first."
            error={fieldErrors.note}
          />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Booking" : "Book this time"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
