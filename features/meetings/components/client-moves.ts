import { editClientBooking } from "../client-actions";
import type { Booking } from "../contract";

/** Saves a meeting the client dragged or stretched, keeping its title and assistants. */
export async function placeBooking(booking: Booking, next: { start: string; end: string }, tell: (message: string, tone: "success" | "danger") => void) {
  const form = new FormData();
  form.set("meetingId", booking.id);
  form.set("title", booking.title);
  form.set("startDate", next.start.slice(0, 10));
  form.set("startTime", next.start.slice(11, 16));
  form.set("endDate", next.end.slice(0, 10));
  form.set("endTime", next.end.slice(11, 16));
  for (const guest of booking.guests) if (guest.kind === "staff") form.append("staffIds", guest.id);
  const result = await editClientBooking(form);
  tell(result.ok ? "Meeting updated." : (result.fieldErrors?.endTime ?? result.fieldErrors?.startTime ?? result.fieldErrors?.staffIds ?? result.message), result.ok ? "success" : "danger");
  return result.ok;
}
