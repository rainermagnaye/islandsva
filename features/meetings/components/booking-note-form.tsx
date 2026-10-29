"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import { BOOKING_LIMITS, type BookingNoteField } from "../contract";

// Adding or editing a note on a meeting's history. The save action comes from the caller so admin and client
// calendars don't ship each other's Server Actions.

export function NoteForm({ meetingId, eventId, defaultValue = "", save, onDone }: {
  meetingId?: string;
  eventId?: string;
  defaultValue?: string;
  save: (formData: FormData) => Promise<SubmitResult<BookingNoteField>>;
  onDone: () => void;
}) {
  return (
    <Form<BookingNoteField> aria-label={eventId ? "Edit note" : "Add a note"} onSubmit={async (formData) => {
      const result = await save(formData);
      if (result.ok) onDone();
      return result;
    }}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-3">
          {meetingId && <input type="hidden" name="meetingId" value={meetingId} />}
          {eventId && <input type="hidden" name="eventId" value={eventId} />}
          <TextField label="Note" name="note" multiline compact required maxLength={BOOKING_LIMITS.note} defaultValue={defaultValue} data-autofocus error={fieldErrors.note} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>{pending ? "Saving" : "Save"}</Button>
          </div>
        </div>
      )}
    </Form>
  );
}
