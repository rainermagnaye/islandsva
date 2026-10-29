import { addDays, wallClockIn, type IsoDate } from "@/components/ui/date-math";
import type { ScheduleGesture } from "@/components/ui/schedule-events";
import { BOOKING_TIME_ZONE, type Booking } from "./contract";

// Shared by the admin and client calendars: the meeting form's starting times and what a meeting may do on the grid.

export type BookingDraft = { startDate: string; startTime: string; endDate: string; endTime: string };

const pad = (value: number) => String(value).padStart(2, "0");

/** A one-hour meeting from a clicked slot (minutes after midnight), ending the next day if it runs past midnight. */
export function draftFrom(day: IsoDate, minute: number): BookingDraft {
  const endTotal = minute + 60;
  const endMinute = endTotal % (24 * 60);
  return {
    startDate: day,
    startTime: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`,
    endDate: endTotal >= 24 * 60 ? addDays(day, 1) : day,
    endTime: `${pad(Math.floor(endMinute / 60))}:${pad(endMinute % 60)}`,
  };
}

/** A meeting's own times, in Philippine time, for the edit form. */
export function draftOf(booking: Pick<Booking, "startsAt" | "endsAt">): BookingDraft {
  const start = wallClockIn(booking.startsAt, BOOKING_TIME_ZONE);
  const end = wallClockIn(booking.endsAt, BOOKING_TIME_ZONE);
  return { startDate: start.slice(0, 10), startTime: start.slice(11, 16), endDate: end.slice(0, 10), endTime: end.slice(11, 16) };
}

/** A scheduled manual meeting moves and stretches in 15-minute steps, up to 8 hours. */
export const MANUAL_GESTURE: ScheduleGesture = { move: true, resize: true, snap: 15, minLength: 15, maxLength: 8 * 60 };

/** A meeting the client booked themselves: they move, edit, cancel and complete it like an admin would. */
export const ownMeeting = (booking: Booking | null | undefined, userId: string) =>
  Boolean(booking && booking.kind === "manual" && booking.createdBy === userId);

/** Only the client's own scheduled meetings move on the grid; the agency's and the demo calls stay put. */
export function clientGesture(booking: Booking | undefined, userId: string): ScheduleGesture | null {
  return ownMeeting(booking, userId) && booking?.status === "scheduled" ? MANUAL_GESTURE : null;
}
