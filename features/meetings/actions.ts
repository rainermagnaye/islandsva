"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { SlotField } from "@/features/demos/contract";
import { parseNewSlots } from "@/features/demos/validation";
import type { VaTaskField } from "@/features/tasks/contract";
import { CONFIRMATION_NOTICE, type BookingField, type BookingNoteField, type ConfirmationOutcome, type ConfirmResult, type DiscoveryOutcomeField, type DiscoveryRejectField, type DiscoveryTimesField, type VaMeetingField } from "./contract";
import { saveDiscoveryTimes, type DiscoveryTimesRefusal } from "./dal";
import { bookingEntries, fileFrom, noteEntries } from "./form-data";
import { addBookingNote, cancelBooking, completeBooking, confirmDiscoveryCall, createAdminMeeting, createAdminSlotMeetings, createBooking, editBookingNote, moveDiscoveryCall, rejectDiscoveryCall, removeBookingNote, saveDiscoveryOutcome, sendConfirmation, updateBooking } from "./service";
import { parseBooking, parseBookingEventId, parseBookingId, parseBookingNote, parseBookingNoteEdit, parseDiscoveryMove, parseDiscoveryOutcome, parseDiscoveryReject, parseDiscoveryTimes, parseVaMeeting } from "./validation";

const REFUSAL_MESSAGES: Record<DiscoveryTimesRefusal, string> = {
  not_allowed: "Your two-factor sign-in has expired. Sign in again, then save.",
  conflict: "Someone else just saved the times. Reload the page to see them, then save again.",
  invalid: FORM_ERROR,
};

/** "Discovery calls" settings: replaces the agency's daily times. The admin check comes first, then RLS. */
export async function saveDiscoveryTimesAction(formData: FormData): Promise<SubmitResult<DiscoveryTimesField>> {
  await requireRole(["admin"]);
  const parsed = parseDiscoveryTimes({ ...formEntries(formData), times: formData.getAll("times") });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await saveDiscoveryTimes(parsed.value.times);
    if (!result.ok) {
      // A form that passed validation but was refused as invalid is a bug worth seeing in the logs.
      if (result.reason === "invalid") console.error("Saving discovery times was refused as invalid");
      return { ok: false, message: REFUSAL_MESSAGES[result.reason] };
    }
  } catch (error) {
    return outageResult(error, "Saving discovery times");
  }
  refresh();
  return { ok: true };
}

/** The admin calendar's New meeting: date, Manila start, length, optional client — same as a VA or Lead Gen. */
export async function addAdminMeeting(formData: FormData): Promise<SubmitResult<VaMeetingField>> {
  await requireRole(["admin"]);
  const entries = formEntries(formData);
  entries.staffIds = formData.getAll("staffIds").filter((item): item is string => typeof item === "string" && item.length > 0);
  const parsed = parseVaMeeting(entries);
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await createAdminMeeting(parsed.value);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Admin meeting create failed", { service: error.service, error });
    return { ok: false, message: "We couldn't book this meeting just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

/** "Book › Demo slots" on the admin calendar: each picked half hour becomes a 30-minute team meeting. */
export async function addAdminSlots(formData: FormData): Promise<SubmitResult<SlotField>> {
  await requireRole(["admin"]);
  const parsed = parseNewSlots({ ...formEntries(formData), times: formData.getAll("times") });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await createAdminSlotMeetings(parsed.value.startsAt);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Admin meeting slots failed", { service: error.service, error });
    return { ok: false, message: "We couldn't add those times just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

export async function addAdminTask(formData: FormData): Promise<SubmitResult<VaTaskField>> {
  await requireRole(["admin"]);
  void formData;
  return { ok: false, message: "Tasks are booked from the VA calendar." };
}

/** An admin adds a booking. The signed-in admin is recorded as the creator. */
export async function addBooking(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["admin"]);
  const parsed = parseBooking(bookingEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const file = await fileFrom(formData);
  if (!file.ok) return { ok: false, message: file.message };
  if (file.file && !parsed.value.note) return { ok: false, message: "Enter a note to go with the attachment.", fieldErrors: { note: "Enter a note." } };

  try {
    const result = await createBooking(parsed.value, file.file);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking create failed", { service: error.service, error });
    return { ok: false, message: "We couldn't add this meeting just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** An admin edits a scheduled booking. Notes already added stay in the history. */
export async function editBooking(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["admin"]);
  const parsed = parseBooking(bookingEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  if (!parsed.value.meetingId) return { ok: false, message: "That meeting no longer exists. Refresh the page." };

  try {
    const result = await updateBooking(parsed.value, parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save this meeting just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function cancelBookingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await cancelBooking(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking cancel failed", { service: error.service, error });
    return { ok: false, message: "We couldn't cancel this meeting just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** An admin marks a scheduled meeting done. The database refuses this before the start time. */
export async function completeBookingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await completeBooking(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking complete failed", { service: error.service, error });
    return { ok: false, message: "We couldn't complete this booking just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function saveBookingNote(formData: FormData): Promise<SubmitResult<BookingNoteField>> {
  await requireRole(["admin"]);
  const parsed = parseBookingNote(noteEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const file = await fileFrom(formData);
  if (!file.ok) return { ok: false, message: file.message };

  try {
    const result = await addBookingNote(parsed.value, file.file);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking note failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save that note just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function saveBookingNoteEdit(formData: FormData): Promise<SubmitResult<BookingNoteField>> {
  await requireRole(["admin"]);
  const parsed = parseBookingNoteEdit(noteEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await editBookingNote(parsed.value.eventId, parsed.value.note);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking note edit failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save that note just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function deleteBookingNoteAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseBookingEventId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await removeBookingNote(parsed.value.eventId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Booking note delete failed", { service: error.service, error });
    return { ok: false, message: "We couldn't delete that note just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** Emails the visitor; an outage counts as a failed send, so the confirm itself still stands. */
async function emailVisitor(meetingId: string, actorId: string): Promise<ConfirmationOutcome> {
  try {
    return await sendConfirmation(meetingId, actorId);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery confirmation email failed", { service: error.service, meetingId });
    return "failed";
  }
}

/**
 * An admin or Lead Gen claims a requested discovery call, then the visitor is emailed. The email is sent here, not in
 * after(), so the result can say whether it went out; a failed email still returns ok (the call is confirmed).
 */
export async function confirmDiscoveryAction(formData: FormData): Promise<ConfirmResult> {
  const user = await requireRole(["admin", "closer"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await confirmDiscoveryCall(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery confirm failed", { service: error.service, error });
    return { ok: false, message: "We couldn't confirm this call just now. Please try again in a moment." };
  }
  const outcome = await emailVisitor(parsed.value.meetingId, user.id);
  refresh();
  return { ok: true, notice: `Meeting confirmed. ${CONFIRMATION_NOTICE[outcome]}` };
}

/** The Send confirmation email button: after a failed send, or with the new time after a reschedule. */
export async function sendDiscoveryConfirmationAction(formData: FormData): Promise<ConfirmResult> {
  const user = await requireRole(["admin", "closer"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const outcome = await emailVisitor(parsed.value.meetingId, user.id);
  refresh();
  if (outcome === "sent" || outcome === "already_sent") return { ok: true, notice: CONFIRMATION_NOTICE[outcome] };
  return { ok: false, message: CONFIRMATION_NOTICE[outcome] };
}

/** An admin or Lead Gen moves a discovery call to another time. */
export async function rescheduleDiscoveryAction(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["admin", "closer"]);
  const parsed = parseDiscoveryMove(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await moveDiscoveryCall(parsed.value.meetingId, parsed.value.startsAt);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery reschedule failed", { service: error.service, error });
    return { ok: false, message: "We couldn't move this call just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

/** A Lead Gen declines a requested discovery call. The reason closes the lead as junk. */
export async function rejectDiscoveryAction(formData: FormData): Promise<SubmitResult<DiscoveryRejectField>> {
  const user = await requireRole(["closer"]);
  const parsed = parseDiscoveryReject(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await rejectDiscoveryCall(parsed.value.meetingId, user.id, parsed.value.reason);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery reject failed", { service: error.service, error });
    return { ok: false, message: "We couldn't decline this call just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

/** The Lead Gen who confirmed a discovery call records Done or No-show after it has started. */
export async function recordDiscoveryOutcomeAction(formData: FormData): Promise<SubmitResult<DiscoveryOutcomeField>> {
  const user = await requireRole(["closer"]);
  const parsed = parseDiscoveryOutcome(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await saveDiscoveryOutcome(parsed.value.meetingId, user.id, parsed.value.outcome, parsed.value.note);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Discovery outcome failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the outcome just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}
