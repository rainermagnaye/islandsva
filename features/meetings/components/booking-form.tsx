"use client";

import type { ReactNode } from "react";
import { AttachmentField } from "@/components/ui/attachment-field";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import type { BookingDraft } from "../booking-draft";
import { acceptBookingAttachment, BOOKING_ATTACHMENT_ACCEPT } from "../attachment";
import { BOOKING_LIMITS, BOOKING_TIME_ZONE, type Booking, type BookingField } from "../contract";

/**
 * The create and edit modal. The creator is the signed-in person and is not editable. Guests and the save
 * action come from the caller so admin and client calendars don't ship each other's Server Actions.
 */
export function BookingForm({
  mode,
  booking,
  draft,
  creatorName,
  save,
  guests,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  booking?: Booking;
  draft: BookingDraft;
  creatorName: string;
  save: (formData: FormData) => Promise<SubmitResult<BookingField>>;
  guests: (fieldErrors: Partial<Record<BookingField, string>>) => ReactNode;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={mode === "create" ? "New meeting" : "Edit meeting"} size="md">
      <Form<BookingField>
        aria-label={mode === "create" ? "New meeting" : "Edit meeting"}
        onSubmit={async (formData) => {
          if (mode === "create") {
            const file = formData.get("attachment");
            const title = formData.get("attachmentName");
            if (file instanceof File && file.size > 0) {
              const accepted = acceptBookingAttachment(file, typeof title === "string" ? title : "");
              if (!accepted.ok) return { ok: false, message: accepted.message };
            }
          }
          const result = await save(formData);
          if (result.ok) onDone();
          return result;
        }}
      >
        {({ pending, fieldErrors }) => (
          <div className="grid gap-4">
            {booking && <input type="hidden" name="meetingId" value={booking.id} />}
            <TextField label="Meeting title" name="title" required maxLength={BOOKING_LIMITS.title} defaultValue={booking?.title} data-autofocus error={fieldErrors.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker label="Start date" name="startDate" required defaultValue={draft.startDate} timeZone={BOOKING_TIME_ZONE} weekStartsOn={1} error={fieldErrors.startDate} />
              <TextField label="Start time" name="startTime" type="time" required defaultValue={draft.startTime} error={fieldErrors.startTime} />
              <DatePicker label="End date" name="endDate" required defaultValue={draft.endDate} timeZone={BOOKING_TIME_ZONE} weekStartsOn={1} error={fieldErrors.endDate} />
              <TextField label="End time" name="endTime" type="time" required defaultValue={draft.endTime} error={fieldErrors.endTime} />
            </div>
            {guests(fieldErrors)}
            <p className="m-0 type-body-sm text-ink-muted">Created by {booking?.creatorName ?? creatorName}</p>
            {mode === "create" && (
              <>
                <TextField label="Notes" name="note" multiline optional maxLength={BOOKING_LIMITS.note} error={fieldErrors.note} />
                <AttachmentField fileName="attachment" nameField="attachmentName" label="Attachment" accept={BOOKING_ATTACHMENT_ACCEPT} hint="A recording, PDF or image, up to 2 MB. Click the name to rename it." />
              </>
            )}
            <div className="mt-2 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Close</Button>
              <Button type="submit" loading={pending}>{pending ? "Saving" : mode === "create" ? "Create meeting" : "Save"}</Button>
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
}
