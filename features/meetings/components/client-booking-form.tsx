"use client";

import { VaAssignField } from "@/features/tasks/components/va-assign-field";
import type { BookingDraft } from "../booking-draft";
import { addClientBooking, editClientBooking } from "../client-actions";
import type { Booking, BookingChoice } from "../contract";
import { BookingForm } from "./booking-form";

/** Client create/edit: invites their own assistants. The company is added for them on the server. */
export function ClientBookingForm({
  mode,
  booking,
  draft,
  staff,
  creatorName,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  booking?: Booking;
  draft: BookingDraft;
  staff: readonly BookingChoice[];
  creatorName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <BookingForm
      mode={mode}
      booking={booking}
      draft={draft}
      creatorName={creatorName}
      save={mode === "create" ? addClientBooking : editClientBooking}
      guests={(fieldErrors) => (
        <VaAssignField
          vas={staff.map((item) => ({ id: item.id, firstName: item.label }))}
          name="staffIds"
          label="Invite assistants"
          initial={booking?.guests.filter((guest) => guest.kind === "staff").map((guest) => guest.id)}
          empty="An assistant needs to be working with you before you can book a meeting."
          error={fieldErrors.staffIds}
        />
      )}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
