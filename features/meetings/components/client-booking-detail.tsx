"use client";

import { cancelClientBookingAction, completeClientBookingAction, saveClientBookingNote } from "../client-actions";
import type { Booking } from "../contract";
import { BookingDetail } from "./booking-detail";
import { AnswerMeetingRequest } from "./meeting-request";

/** Client booking sheet: cancel, complete and add a note on meetings they created; answer one their VA asked for. */
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
      banner={booking.kind === "manual" && booking.status === "requested" && !canManage ? <AnswerMeetingRequest booking={booking} onDone={onDone} /> : undefined}
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
