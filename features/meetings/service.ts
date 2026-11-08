import "server-only";
import { env } from "@/lib/env";
import { UpstreamError } from "@/lib/upstream-error";
import { cancelBookingRow, completeBookingRow, confirmDiscovery, deleteBookingNote, insertAdminMeeting, insertBooking, insertBookingNote, recordDiscoveryOutcome, rejectDiscovery, rescheduleDiscovery, saveBooking, updateBookingNote } from "./dal";
import { answerVaMeetingRow, cancelClientBookingRow, completeClientBookingRow, insertClientBooking, insertClientBookingNote, saveClientBooking } from "./client-dal";
import { cancelCloserMeetingRow, cancelVaMeetingRow, insertCloserMeeting, insertVaMeeting, listVaTeam, rescheduleCalendarMeetingRow } from "./va-dal";
import { listBookings } from "./booking-dal";
import { claimConfirmation, releaseConfirmation } from "./confirmation-dal";
import type { ConfirmationOutcome } from "./contract";
import { sendDiscoveryAcknowledgement, sendDiscoveryConfirmation, sendDiscoveryExpired } from "./email";
import { claimAcknowledgement, claimExpiryNotices } from "./visitor-email-dal";
import type { BookingFile as FileInput } from "./form-data";
import type { BookingInput, BookingNoteInput, VaMeetingInput } from "./validation";

export function createBooking(input: BookingInput, file: FileInput) {
  return insertBooking(input, file);
}

/** A meeting an admin books from the calendar: with a client (it waits if they have a login) or with the team only. */
export function createAdminMeeting(input: VaMeetingInput) {
  return insertAdminMeeting(input);
}

/** One 30-minute team meeting per start, from the admin calendar's "Demo slots" grid. */
export async function createAdminSlotMeetings(startsAt: readonly string[]) {
  for (const start of startsAt) {
    const result = await insertAdminMeeting({
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

/** Drag or stretch on the VA, Lead Gen or admin calendar. The RPC checks the actor. */
export function rescheduleCalendarMeeting(meetingId: string, startsAt: string, endsAt: string) {
  return rescheduleCalendarMeetingRow(meetingId, startsAt, endsAt);
}

/**
 * Emails the visitor that their discovery call is confirmed, at most once per start: claim (stamps the call),
 * send, and release the claim if the send failed so the Lead Gen can try again. Only the live site sends: staging,
 * previews and local development share the production database, so they would email real visitors.
 */
export async function sendConfirmation(meetingId: string, actorId: string): Promise<ConfirmationOutcome> {
  if (!env.isLiveDeployment()) return "skipped";
  const claim = await claimConfirmation(meetingId, actorId);
  if (!claim.ok) return claim.reason;
  if (!claim.call) return "already_sent";
  const sent = await sendDiscoveryConfirmation({ meetingId, email: claim.call.email, startsAt: claim.call.startsAt, country: claim.call.country });
  if (sent) return "sent";
  await releaseConfirmation(meetingId, claim.call.claimedAt);
  return "failed";
}

/**
 * Emails the visitor that their discovery request was received, once per request and within the limits the claim
 * enforces. Runs in after(), so it never throws: the request is already stored, and a failed courtesy email is logged,
 * not retried. Only the live site sends (see sendConfirmation).
 */
export async function sendAcknowledgement(leadId: string) {
  if (!env.isLiveDeployment()) return;
  try {
    const call = await claimAcknowledgement(leadId);
    if (call) await sendDiscoveryAcknowledgement(call);
  } catch (error) {
    console.error("Discovery acknowledgement failed", { leadId, service: error instanceof UpstreamError ? error.service : undefined });
  }
}

/**
 * Emails each visitor whose request expired unconfirmed, once per request. Called from the internal endpoint the
 * scheduled job hits, in after(), so it never throws; a failed courtesy email is logged, not retried. Only the live site
 * sends (see sendConfirmation).
 */
export async function sendExpiryNotices() {
  if (!env.isLiveDeployment()) return;
  try {
    for (const call of await claimExpiryNotices()) {
      await sendDiscoveryExpired(call);
    }
  } catch (error) {
    console.error("Discovery expiry notices failed", { service: error instanceof UpstreamError ? error.service : undefined });
  }
}
