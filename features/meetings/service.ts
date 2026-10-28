import "server-only";
import { cancelBookingRow, completeBookingRow, confirmDiscovery, deleteBookingNote, insertBooking, insertBookingNote, rescheduleDiscovery, saveBooking, updateBookingNote } from "./dal";
import { cancelClientBookingRow, completeClientBookingRow, insertClientBooking, insertClientBookingNote, saveClientBooking } from "./client-dal";
import type { BookingFile as FileInput } from "./form-data";
import type { BookingInput, BookingNoteInput } from "./validation";

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

export function createClientBooking(input: BookingInput, file: FileInput) {
  return insertClientBooking(input, file);
}

export function updateClientBooking(input: BookingInput, meetingId: string) {
  return saveClientBooking(input, meetingId);
}

export function cancelClientBooking(meetingId: string) {
  return cancelClientBookingRow(meetingId);
}

export function completeClientBooking(meetingId: string) {
  return completeClientBookingRow(meetingId);
}

export function addClientBookingNote(input: BookingNoteInput, file: FileInput) {
  return insertClientBookingNote(input, file);
}
