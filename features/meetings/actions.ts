"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { acceptBookingAttachment } from "./attachment";
import type { BookingField, BookingNoteField, DiscoveryTimesField } from "./contract";
import { saveDiscoveryTimes, type DiscoveryTimesRefusal } from "./dal";
import { addBookingNote, cancelBooking, completeBooking, confirmDiscoveryCall, createBooking, editBookingNote, moveDiscoveryCall, removeBookingNote, updateBooking } from "./service";
import { parseBooking, parseBookingEventId, parseBookingId, parseBookingNote, parseBookingNoteEdit, parseDiscoveryMove, parseDiscoveryTimes } from "./validation";

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

async function fileFrom(formData: FormData) {
  const file = formData.get("attachment");
  const title = formData.get("attachmentName");
  if (!(file instanceof File) || file.size === 0) return { ok: true as const, file: null };
  const named = typeof title === "string" ? title : "";
  const accepted = acceptBookingAttachment(file, named);
  if (!accepted.ok) return { ok: false as const, message: accepted.message };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = acceptBookingAttachment({ name: file.name, type: file.type, size: bytes.byteLength }, named);
  if (!checked.ok) return { ok: false as const, message: checked.message };
  return { ok: true as const, file: { name: checked.name, type: checked.type, base64: Buffer.from(bytes).toString("base64") } };
}

function noteEntries(formData: FormData) {
  const value = formEntries(formData);
  delete value.attachment;
  delete value.attachmentName;
  return value;
}

function entries(formData: FormData) {
  const value = formEntries(formData);
  delete value.attachment;
  delete value.attachmentName;
  const ids = (name: string) => formData.getAll(name).filter((item): item is string => typeof item === "string" && item.length > 0);
  value.clientIds = ids("clientIds");
  value.staffIds = ids("staffIds");
  return value;
}

/** An admin adds a booking. The signed-in admin is recorded as the creator. */
export async function addBooking(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["admin"]);
  const parsed = parseBooking(entries(formData));
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
  const parsed = parseBooking(entries(formData));
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

/** An admin or Lead Gen claims a requested discovery call. */
export async function confirmDiscoveryAction(formData: FormData): Promise<SubmitResult<"meetingId">> {
  await requireRole(["admin", "closer"]);
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
  refresh();
  return { ok: true };
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
