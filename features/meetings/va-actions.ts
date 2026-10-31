"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { VaMeetingField } from "./contract";
import { cancelVaMeeting, createVaMeeting } from "./service";
import { parseBookingId, parseVaMeeting } from "./validation";

// The VA calendar's meeting actions. The VA check comes first; the database then checks the VA is open, the client
// is theirs and the meeting is one they booked.

function retry(error: unknown, what: string, message: string): SubmitResult<never> {
  if (!(error instanceof UpstreamError)) throw error;
  console.error(`VA meeting ${what} failed`, { service: error.service, error });
  return { ok: false, message };
}

export async function addVaMeeting(formData: FormData): Promise<SubmitResult<VaMeetingField>> {
  await requireRole(["va"]);
  const entries = formEntries(formData);
  entries.staffIds = formData.getAll("staffIds").filter((item): item is string => typeof item === "string" && item.length > 0);
  const parsed = parseVaMeeting(entries);
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await createVaMeeting(parsed.value);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "save", "We couldn't book this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}

export async function cancelVaMeetingAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["va"]);
  const parsed = parseBookingId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await cancelVaMeeting(parsed.value.meetingId);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    return retry(error, "cancel", "We couldn't cancel this meeting just now. Please try again in a moment.");
  }
  refresh();
  return { ok: true };
}
