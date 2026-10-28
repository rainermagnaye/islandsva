"use client";

import { addBooking, editBooking } from "../actions";
import type { BookingDraft } from "../booking-draft";
import type { Booking, BookingChoice } from "../contract";
import { BookingForm } from "./booking-form";
import { InviteField } from "./invite-field";

/** Admin create/edit: invites anyone in the agency and saves through the admin Server Actions. */
export function AdminBookingForm({
  mode,
  booking,
  draft,
  clients,
  staff,
  creatorName,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  booking?: Booking;
  draft: BookingDraft;
  clients: readonly BookingChoice[];
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
      save={mode === "create" ? addBooking : editBooking}
      guests={(fieldErrors) => (
        <InviteField clients={clients} staff={staff} guests={booking?.guests ?? []} error={fieldErrors.clientIds ?? fieldErrors.staffIds} />
      )}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
