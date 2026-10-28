"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { saveBookingNote, saveBookingNoteEdit } from "../actions";
import { saveClientBookingNote } from "../client-actions";
import { BOOKING_LIMITS, type BookingNoteField } from "../contract";

// Adding or editing a note on a meeting's history (saveBookingNote / saveBookingNoteEdit; a client only adds).

export function NoteForm({ meetingId, eventId, defaultValue = "", audience = "admin", onDone }: { meetingId?: string; eventId?: string; defaultValue?: string; audience?: "admin" | "client"; onDone: () => void }) {
  return (
    <Form<BookingNoteField> aria-label={eventId ? "Edit note" : "Add a note"} onSubmit={async (formData) => {
      const result = eventId ? await saveBookingNoteEdit(formData) : audience === "client" ? await saveClientBookingNote(formData) : await saveBookingNote(formData);
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
