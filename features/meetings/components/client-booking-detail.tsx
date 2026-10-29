"use client";

import { cancelClientBookingAction, completeClientBookingAction, saveClientBookingNote } from "../client-actions";
import type { Booking } from "../contract";
import { BookingDetail } from "./booking-detail";

/** Client booking sheet: cancel, complete and add a note on meetings they created. */
export function ClientBookingDetail({
  booking,
  canManage,
  onClose,
  onEdit,
  onDone,
}: {
  booking: Booking;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <BookingDetail
      booking={booking}
      canManage={canManage}
      onClose={onClose}
      onEdit={onEdit}
      onDone={onDone}
      actions={{
        cancel: cancelClientBookingAction,
        complete: completeClientBookingAction,
        note: saveClientBookingNote,
      }}
    />
  );
}
