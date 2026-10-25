"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { appRoutes } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { BookingRefusal } from "./booking-dal";
import type { BookField } from "./contract";
import { answerDemo, notifyDemoCancelled, notifyDemoDecided, notifyDemoRequested, requestDemo, withdrawDemo } from "./service";
import { parseBooking, parseBookingId, parseDecision } from "./validation";

// Demo booking actions. The session comes first (a client, or a VA for decisions); the database functions then
// check the actor again. Emails go out after the response.

const REFUSED: Record<BookingRefusal, string> = {
  not_found: "That demo no longer exists. Refresh the page.",
  not_allowed: "You can't change this demo.",
  has_va: "You already have a VA, so there's no demo to book.",
  open_demo: "You already have a demo booked. Cancel it first to pick another time.",
  slot_taken: "That time was just taken. Please pick another.",
  out_of_range: "Pick a time at least 4 hours and at most 14 days ahead.",
  too_late: "This demo has already started or been answered, so it can't change now.",
  inactive: "Your account isn't active, so a demo can't be booked. Please contact your Islands VA contact.",
};
const OUTAGE = "That didn't go through just now. Please try again in a moment.";

function outage(error: unknown, what: string): { ok: false; message: string } {
  if (!(error instanceof UpstreamError)) throw error;
  console.error(`${what} failed`, { service: error.service, error: error.message });
  return { ok: false, message: OUTAGE };
}

/** "Book this time": books the chosen slot, tells the VA, and returns the client to their dashboard. */
export async function bookDemoAction(formData: FormData): Promise<SubmitResult<BookField>> {
  const user = await requireRole(["client"]);
  const parsed = parseBooking(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await requestDemo(user.id, parsed.value.slotId, parsed.value.note);
    if (!result.ok) {
      const message = REFUSED[result.reason];
      return result.reason === "slot_taken" || result.reason === "out_of_range" ? { ok: false, message, fieldErrors: { slotId: message } } : { ok: false, message };
    }
    after(async () => {
      await notifyDemoRequested(result.value);
    });
  } catch (error) {
    return outage(error, "Booking a demo");
  }
  redirect(appRoutes.client);
}

/** The client cancels their demo before it starts. */
export async function cancelDemoAction(bookingId: unknown): Promise<SubmitResult> {
  const user = await requireRole(["client"]);
  const parsed = parseBookingId({ bookingId });
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    const result = await withdrawDemo(user.id, parsed.value.bookingId);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
    after(async () => {
      await notifyDemoCancelled(result.value);
    });
  } catch (error) {
    return outage(error, "Cancelling a demo");
  }
  refresh();
  return { ok: true };
}

/** The VA confirms or declines a request (with an optional reason for the client). */
export async function decideDemoAction(formData: FormData): Promise<SubmitResult<"reason">> {
  const user = await requireRole(["va"]);
  const parsed = parseDecision(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await answerDemo(user.id, parsed.value.bookingId, parsed.value.decision, parsed.value.reason);
    if (!result.ok) return { ok: false, message: result.reason === "not_allowed" ? "Only the VA the client booked can answer this request." : REFUSED[result.reason] };
    after(async () => {
      await notifyDemoDecided(result.value);
    });
  } catch (error) {
    return outage(error, "Answering a demo request");
  }
  refresh();
  return { ok: true };
}
