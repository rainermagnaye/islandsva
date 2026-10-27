import "server-only";
import { cancelBookingRow, completeBookingRow, confirmDiscovery, deleteBookingNote, insertBooking, insertBookingNote, rescheduleDiscovery, saveBooking, updateBookingNote } from "./dal";
import type { BookingInput, BookingNoteInput } from "./validation";

type FileInput = { name: string; type: string; base64: string } | null;

export function createBooking(input: BookingInput, file: FileInput) {
  return insertBooking(input, file);
}

export function updateBooking(input: BookingInput, meetingId: string) {
  return saveBooking(input, meetingId);
}

export function cancelBooking(meetingId: string) {
  return cancelBookingRow(meetingId);
}

export function completeBooking(meetingId: string) {
  return completeBookingRow(meetingId);
}

export function addBookingNote(input: BookingNoteInput, file: FileInput) {
  return insertBookingNote(input, file);
}

export function editBookingNote(eventId: string, note: string) {
  return updateBookingNote(eventId, note);
}

export function removeBookingNote(eventId: string) {
  return deleteBookingNote(eventId);
}

export function confirmDiscoveryCall(meetingId: string) {
  return confirmDiscovery(meetingId);
}

export function moveDiscoveryCall(meetingId: string, startsAt: string) {
  return rescheduleDiscovery(meetingId, startsAt);
}
