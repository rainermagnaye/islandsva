"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { SlotField } from "@/features/demos/contract";
import { parseNewSlots } from "@/features/demos/validation";
import type { VaTaskField } from "@/features/tasks/contract";
import { bookVaTask } from "@/features/tasks/service";
import { parseVaTask } from "@/features/tasks/validation";
import type { VaMeetingField } from "./contract";
import { vaMeetingEntries } from "./form-data";
import { cancelCloserMeeting, createCloserMeeting, createCloserSlotMeetings } from "./service";
import { parseBookingId, parseVaMeeting } from "./validation";

// The closer calendar's meeting actions. The closer check comes first; the database then checks they own the
// client (or booked a team call) and that the meeting is one they created.

function retry(error: unknown, what: string, message: string): SubmitResult<never> {
  if (!(error instanceof UpstreamError)) throw error;
  console.error(`Closer meeting ${what} failed`, { service: error.service, error: error.message });
  return { ok: false, message };
}

/** "Book › Demo slots" on the closer calendar: each picked half hour becomes a 30-minute team meeting. */
export async function addCloserSlots(formData: FormData): Promise<SubmitResult<SlotField>> {
  await requireRole(["closer"]);
  const parsed = parseNewSlots({ ...formEntries(formData), times: formData.getAll("times") });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await createCloserSlotMeetings(parsed.value.startsAt);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "slots", "We couldn't add those times just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

/** "Book › Task" on the Lead Gen calendar: a to-do of their own at the chosen time. */
export async function addCloserTask(formData: FormData): Promise<SubmitResult<VaTaskField>> {
  const user = await requireRole(["closer"]);
  const parsed = parseVaTask(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await bookVaTask(user.id, parsed.value);
    if (!result.ok) {
      return result.field
        ? { ok: false, message: FIELD_ERRORS, fieldErrors: { [result.field]: result.message } as Partial<Record<VaTaskField, string>> }
        : { ok: false, message: result.message };
    }
  } catch (error) {
    return outageResult(error, "Booking a Lead Gen task");
  }
  refresh();
  return { ok: true };
}

export async function addCloserMeeting(formData: FormData): Promise<SubmitResult<VaMeetingField>> {
  await requireRole(["closer"]);
  const parsed = parseVaMeeting(vaMeetingEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await createCloserMeeting(parsed.value);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "save", "We couldn't book this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

export async function cancelCloserMeetingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["closer"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await cancelCloserMeeting(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "cancel", "We couldn't cancel this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}
