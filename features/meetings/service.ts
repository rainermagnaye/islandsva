import "server-only";
import { cancelBookingRow, completeBookingRow, confirmDiscovery, deleteBookingNote, insertBooking, insertBookingNote, recordDiscoveryOutcome, rejectDiscovery, rescheduleDiscovery, saveBooking, updateBookingNote } from "./dal";
import { answerVaMeetingRow, cancelClientBookingRow, completeClientBookingRow, insertClientBooking, insertClientBookingNote, saveClientBooking } from "./client-dal";
import { cancelCloserMeetingRow, cancelVaMeetingRow, insertCloserMeeting, insertVaMeeting, listVaTeam } from "./va-dal";
import { listBookings } from "./booking-dal";
import type { BookingFile as FileInput } from "./form-data";
import type { BookingInput, BookingNoteInput, VaMeetingInput } from "./validation";

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

export function rejectDiscoveryCall(meetingId: string, actorId: string, reason: string) {
  return rejectDiscovery(meetingId, actorId, reason);
}

export function saveDiscoveryOutcome(meetingId: string, actorId: string, outcome: "done" | "no_show", note: string) {
  return recordDiscoveryOutcome(meetingId, actorId, outcome, note);
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

/** The signed-in person's meetings (RLS decides which), for features that need their busy times. */
export function listOwnBookings() {
  return listBookings();
}

/** A meeting a VA books: with their client (it waits for the client's answer) or with the team only. */
export function createVaMeeting(input: VaMeetingInput) {
  return insertVaMeeting(input);
}

export function cancelVaMeeting(meetingId: string) {
  return cancelVaMeetingRow(meetingId);
}

export function answerVaMeeting(meetingId: string, accept: boolean) {
  return answerVaMeetingRow(meetingId, accept);
}

/** Staff a VA can invite to a team meeting. Call only after requireRole(["va"]). */
export function listTeamForVa(vaId: string) {
  return listVaTeam(vaId);
}

export function createCloserMeeting(input: VaMeetingInput) {
  return insertCloserMeeting(input);
}

/** One 30-minute team meeting per start, from the closer's "Demo slots" grid. */
export async function createCloserSlotMeetings(startsAt: readonly string[]) {
  for (const start of startsAt) {
    const result = await insertCloserMeeting({
      title: "Meeting",
      clientId: null,
      staffIds: [],
      note: "",
      startsAt: start,
      endsAt: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
    });
    if (!result.ok) return result;
  }
  return { ok: true as const };
}

export function cancelCloserMeeting(meetingId: string) {
  return cancelCloserMeetingRow(meetingId);
}

/** Staff a Lead Gen can invite. Call only after requireRole(["closer"]). */
export function listTeamForCloser(closerId: string) {
  return listVaTeam(closerId);
}
