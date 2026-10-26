"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { TimeSlotPicker } from "@/components/ui/time-slot-picker";
import { bookDemoAction } from "../booking-actions";
import { DEMO_LIMITS, VA_TIME_ZONE, type BookField } from "../contract";

/** One bookable time: the slot to book and its wall-clock start in the client's zone ("2026-11-03T09:30"). */
export type BookableSlot = { slotId: string; start: string };

/**
 * "Book a demo": a calendar of the days with open times (the rest can't be picked), then that day's times in the
 * client's zone with the VA's Manila time under each, and an optional note. The form posts the slot id; the
 * server books it and refuses one taken meanwhile.
 */
type BookDemoFormProps = {
  slots: readonly BookableSlot[];
  timeZone: string;
  /** Today in the client's zone, computed on the server: client components don't read the clock while rendering. */
  today: string;
};

export function BookDemoForm({ slots, timeZone, today }: BookDemoFormProps) {
  const days = [...new Set(slots.map((slot) => slot.start.slice(0, 10)))].sort();
  const [day, setDay] = useState(days[0]);
  const daySlots = slots.filter((slot) => slot.start.startsWith(day));

  return (
    <Form<BookField> aria-label="Book a demo call" onSubmit={bookDemoAction} className="gap-5">
      {({ pending, fieldErrors }) => (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <Calendar
              value={day}
              onChange={setDay}
              min={days[0]}
              max={days.at(-1)}
              defaultMonth={days[0]}
              isDateDisabled={(date) => !days.includes(date)}
              today={today}
            />
            <div className="grid gap-2">
              <TimeSlotPicker key={day} date={day} timeZone={timeZone} otherTimeZone={VA_TIME_ZONE} name="slotId" slots={daySlots.map((slot) => ({ start: slot.start, value: slot.slotId }))} />
              {fieldErrors.slotId && <p className="m-0 type-label text-status-danger">{fieldErrors.slotId}</p>}
            </div>
          </div>
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
