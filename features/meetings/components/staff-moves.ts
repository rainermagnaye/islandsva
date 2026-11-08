import { rescheduleCalendarMeetingAction, rescheduleDiscoveryAction } from "../actions";
import type { Booking } from "../contract";

/** Saves a meeting the staff member dragged or stretched. Discovery calls keep their 30 minutes. */
export async function placeStaffBooking(booking: Pick<Booking, "id" | "kind">, next: { start: string; end: string }, tell: (message: string, tone: "success" | "danger") => void) {
  const form = new FormData();
  form.set("meetingId", booking.id);
  form.set("startDate", next.start.slice(0, 10));
  form.set("startTime", next.start.slice(11, 16));
  if (booking.kind === "discovery") {
    const result = await rescheduleDiscoveryAction(form);
    tell(result.ok ? "Meeting moved." : (result.fieldErrors?.startTime ?? result.message), result.ok ? "success" : "danger");
    return result.ok;
  }
  form.set("endDate", next.end.slice(0, 10));
  form.set("endTime", next.end.slice(11, 16));
  const result = await rescheduleCalendarMeetingAction(form);
  tell(result.ok ? "Meeting updated." : (result.fieldErrors?.endTime ?? result.fieldErrors?.startTime ?? result.message), result.ok ? "success" : "danger");
  return result.ok;
}
