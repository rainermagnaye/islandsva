"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { BookingField, BookingNoteField } from "./contract";
import { bookingEntries, fileFrom, noteEntries } from "./form-data";
import { addClientBookingNote, cancelClientBooking, completeClientBooking, createClientBooking, updateClientBooking } from "./service";
import { parseBooking, parseBookingId, parseBookingNote } from "./validation";

// The client calendar's meeting actions. The client check comes first; the database then checks the guests are
// the client's own assistants and the meeting is one they created.

const NO_ASSISTANT = "Invite at least one of your assistants.";

function retry(error: unknown, what: string, message: string): SubmitResult<never> {
  if (!(error instanceof UpstreamError)) throw error;
  console.error(`Client meeting ${what} failed`, { service: error.service, error });
  return { ok: false, message };
}

/** The meeting form as a client sends it. The company is always the client's own, so no client ids are read. */
function clientBooking(formData: FormData) {
  const value = bookingEntries(formData);
  delete value.clientIds;
  return parseBooking(value);
}

export async function addClientBooking(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["client"]);
  const parsed = clientBooking(formData);
  if (!parsed.ok) return toSubmitResult(parsed);
  if (parsed.value.staffIds.length === 0) return { ok: false, message: NO_ASSISTANT, fieldErrors: { staffIds: NO_ASSISTANT } };
  const file = await fileFrom(formData);
  if (!file.ok) return { ok: false, message: file.message };
  if (file.file && !parsed.value.note) return { ok: false, message: "Enter a note to go with the attachment.", fieldErrors: { note: "Enter a note." } };

  try {
    const result = await createClientBooking(parsed.value, file.file);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "create", "We couldn't add this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

/** Edit, move or resize one of the client's own meetings. */
export async function editClientBooking(formData: FormData): Promise<SubmitResult<BookingField>> {
  await requireRole(["client"]);
  const parsed = clientBooking(formData);
  if (!parsed.ok) return toSubmitResult(parsed);
  if (!parsed.value.meetingId) return { ok: false, message: "That meeting no longer exists. Refresh the page." };
  if (parsed.value.staffIds.length === 0) return { ok: false, message: NO_ASSISTANT, fieldErrors: { staffIds: NO_ASSISTANT } };

  try {
    const result = await updateClientBooking(parsed.value, parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "save", "We couldn't save this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

export async function cancelClientBookingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["client"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await cancelClientBooking(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "cancel", "We couldn't cancel this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

export async function completeClientBookingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["client"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await completeClientBooking(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "complete", "We couldn't complete this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

export async function saveClientBookingNote(formData: FormData): Promise<SubmitResult<BookingNoteField>> {
  await requireRole(["client"]);
  const parsed = parseBookingNote(noteEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const file = await fileFrom(formData);
  if (!file.ok) return { ok: false, message: file.message };
  try {
    const result = await addClientBookingNote(parsed.value, file.file);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "note", "We couldn't save that note just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}
