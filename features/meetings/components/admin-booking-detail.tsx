"use client";

import { cancelBookingAction, completeBookingAction, confirmDiscoveryAction, deleteBookingNoteAction, rescheduleDiscoveryAction, saveBookingNote, saveBookingNoteEdit } from "../actions";
import type { Booking } from "../contract";
import { BookingDetail } from "./booking-detail";

/** Admin booking sheet: confirm, reschedule, edit notes, cancel and complete. */
export function AdminBookingDetail({
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
        cancel: cancelBookingAction,
        complete: completeBookingAction,
        note: saveBookingNote,
        editNote: saveBookingNoteEdit,
        deleteNote: deleteBookingNoteAction,
        confirmDiscovery: confirmDiscoveryAction,
        rescheduleDiscovery: rescheduleDiscoveryAction,
      }}
    />
  );
}
