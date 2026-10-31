import { instantInZone } from "@/components/ui/date-math";

// Meetings (discovery calls first): limits and labels both sides share. No Zod, safe for client imports.
// The limits mirror the database (supabase/migrations/20261026111332_discovery_calls.sql): keep them in step.

/** Discovery times are times of day in Philippine time (UTC+8 all year, no daylight saving). */
export const DISCOVERY_ZONE = "Asia/Manila";

export const DISCOVERY_LIMITS = {
  /** At most this many times a day (discovery_times.position 1–6). */
  maxTimes: 6,
  callMinutes: 30,
  /** A visitor requests a call at least this long ahead… */
  minNoticeHours: 12,
  /** …and at most this far ahead. */
  maxDaysAhead: 14,
} as const;

/** Every half hour of a day, "00:00" to "23:30" — the times an admin may choose. */
export const DISCOVERY_TIME_OPTIONS: readonly string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

/** "09:00" → "9:00 AM". */
export function timeLabel(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export type DiscoveryTimesField = "times";

// Admin calendar bookings. Limits mirror the manual-meetings migration. No Zod, safe for client imports.

export const BOOKING_LIMITS = {
  title: 120,
  note: 1000,
  /** A booking ends after it starts and lasts at most this many hours. */
  hours: 8,
  /** Clients and staff together on one meeting. */
  guests: 20,
} as const;

/** How long a meeting a VA books can run, in minutes (the database allows up to 8 hours). */
export const VA_MEETING_LENGTHS = [15, 30, 45, 60, 90, 120] as const;

export type VaMeetingField = "title" | "clientId" | "staffIds" | "date" | "startTime" | "minutes" | "note";

export const MANILA_OFFSET = "+08:00";
export const BOOKING_TIME_ZONE = "Asia/Manila";

export type BookingStatus = "requested" | "scheduled" | "cancelled" | "done";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  done: "Completed",
};

export type BookingKind = "manual" | "discovery";

export type BookingEventKind = "requested" | "scheduled" | "updated" | "cancelled" | "rejected" | "done" | "no_show" | "expired" | "note";

export const BOOKING_EVENT_LABELS: Record<BookingEventKind, string> = {
  requested: "Requested",
  scheduled: "Confirmed",
  updated: "Rescheduled",
  cancelled: "Cancelled",
  rejected: "Declined",
  done: "Done",
  no_show: "No show",
  expired: "Expired",
  note: "Note",
};

export type DiscoveryRequest = {
  meetingId: string;
  startsAt: string;
  endsAt: string;
  fullName: string;
  companyName: string | null;
};

export type BookingChoice = { id: string; label: string };

export type BookingGuest = { id: string; kind: "client" | "staff"; name: string };

export type BookingEvent = {
  id: string;
  kind: BookingEventKind;
  body: string | null;
  actorName: string;
  createdAt: string;
  attachmentName: string | null;
  attachmentType: string | null;
};

export type Booking = {
  id: string;
  kind: BookingKind;
  title: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  leadId: string | null;
  clientId: string | null;
  clientName: string | null;
  staffId: string | null;
  staffName: string | null;
  guests: BookingGuest[];
  creatorName: string;
  /** Who created a manual meeting (an admin or the client who booked it); null for a discovery call. */
  createdBy: string | null;
  /** The visitor's zone for a discovery call, so the view can show their clock beside Philippine time. */
  timeZone: string | null;
  timeZoneCity: string | null;
  events: BookingEvent[];
};

export type BookingField = "title" | "startDate" | "startTime" | "endDate" | "endTime" | "clientIds" | "staffIds" | "note";
export type BookingNoteField = "note";

/** A Manila date ("2026-11-03") and time ("09:30") as a UTC ISO timestamp. */
export function manilaToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00${MANILA_OFFSET}`).toISOString();
}

const DISCOVERY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** A discovery call is 30 minutes, on the hour or half hour in `timeZone`, from now through 14 days. */
export function discoveryStart(date: string, time: string, now = Date.now(), timeZone = BOOKING_TIME_ZONE): { ok: true; startsAt: string } | { ok: false; message: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Choose a date." };
  if (!/^([01]\d|2[0-3]):(00|30)$/.test(time)) return { ok: false, message: "Choose an hour or half hour." };
  const startsAt = timeZone === BOOKING_TIME_ZONE ? manilaToIso(date, time) : instantInZone(date, time, timeZone);
  const start = Date.parse(startsAt);
  if (Number.isNaN(start) || start <= now || start > now + DISCOVERY_WINDOW_MS) {
    return { ok: false, message: "Choose a time from now through the next 14 days." };
  }
  return { ok: true, startsAt };
}

const whenFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: BOOKING_TIME_ZONE });

/** Both ends in Philippine time, which is how the booking was entered. */
export function formatBookingWhen(start: string, end: string) {
  return `${whenFormat.format(new Date(start))} – ${whenFormat.format(new Date(end))} PHT`;
}
