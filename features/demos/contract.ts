// Demo calls: limits, labels and the pure rules both sides share. No Zod, safe for client imports.
// The limits mirror the database (demo_scheduling migration): keep them in step.

export const DEMO_LIMITS = {
  slotMinutes: 30,
  /** A VA publishes slots at most this far ahead. */
  publishDays: 30,
  /** A client books at least this long before the start… */
  noticeHours: 4,
  /** …and at most this far ahead. */
  bookDays: 14,
  note: 500,
  reason: 300,
} as const;

/** VAs work from the Philippines and enter times there (UTC+8 all year, no daylight saving). */
export const VA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET = "+08:00";

export type DemoStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "expired";

export const DEMO_STATUS_LABELS: Record<DemoStatus, string> = {
  pending: "Requested",
  confirmed: "Confirmed",
  rejected: "Declined",
  cancelled: "Cancelled",
  completed: "Done",
  expired: "Expired",
};

/** Every 30-minute start time of a day, "00:00" to "23:30". */
export const SLOT_TIMES: readonly string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** A Manila date ("2026-11-03") and time ("09:30") as a UTC ISO timestamp. */
export function manilaToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00${MANILA_OFFSET}`).toISOString();
}

/** The Manila calendar date ("2026-11-03") of a moment. */
export function manilaDate(iso: string | Date) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * What a booking is now. The database settles stale bookings only at the next booking (no cron), so a request
 * nobody answered before it started reads as expired, and a confirmed demo that has ended as done.
 */
export function demoState(booking: { status: DemoStatus; startsAt: string; endsAt: string }, now = new Date()): DemoStatus {
  if (booking.status === "pending" && new Date(booking.startsAt) <= now) return "expired";
  if (booking.status === "confirmed" && new Date(booking.endsAt) <= now) return "completed";
  return booking.status;
}

/** Still open: counts against the one-demo rule and can be cancelled (client) or decided (VA, pending only). */
export const isOpenDemo = (state: DemoStatus) => state === "pending" || state === "confirmed";

/** A VA's slot on their calendar, with what has happened to it. */
export type VaSlot = { id: string; startsAt: string; booking: { status: DemoStatus; companyName: string } | null };

export type SlotField = "date" | "times";

/** The client's latest demo, as their dashboard shows it. */
export type ClientDemo = {
  id: string;
  status: DemoStatus;
  startsAt: string;
  endsAt: string;
  vaName: string;
  rejectReason: string | null;
};

/** One bookable time. Several VAs may offer the same time; the client picks a time, not a person. */
export type BookableTime = { slotId: string; startsAt: string };

export type BookField = "slotId" | "note";

/** One time per start: the first slot offered at each time (slots arrive sorted by start). */
export function bookableTimes(slots: readonly { id: string; startsAt: string }[]): BookableTime[] {
  const seen = new Set<string>();
  const times: BookableTime[] = [];
  for (const slot of slots) {
    if (seen.has(slot.startsAt)) continue;
    seen.add(slot.startsAt);
    times.push({ slotId: slot.id, startsAt: slot.startsAt });
  }
  return times;
}

/** A time zone Intl knows, or UTC: stored zones are checked at entry, but a bad one must never break a page or an email. */
export function safeTimeZone(zone: string | null) {
  if (!zone) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** A moment in a time zone, for emails and screens ("Tue, Nov 3, 9:30 AM EST"). Falls back to UTC for a bad zone. */
export function formatInZone(iso: string, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: safeTimeZone(timeZone) }).format(new Date(iso));
}

/** The admin list's filters: open ones by what they are now (a past request isn't "requested" any more). */
export const ADMIN_DEMO_FILTERS = { requested: "Requested", confirmed: "Confirmed", rejected: "Declined", cancelled: "Cancelled" } as const;
export type AdminDemoFilter = keyof typeof ADMIN_DEMO_FILTERS;

/** One row of the admin list. */
export type AdminDemo = {
  id: string;
  clientId: string;
  companyName: string;
  clientTimezone: string | null;
  vaName: string;
  status: DemoStatus;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  /** Whether the client has an active VA now (after a done demo, the next step is assigning one). */
  clientHasVa: boolean;
};

export type AdminDemoPage = { demos: AdminDemo[]; total: number; page: number; pageCount: number };

/** What the agency does next for a demo, as the admin list shows it: after a done demo, the client still needs a VA. */
export type AdminNextStep = "assign_va" | "await_va_answer" | "call_booked" | null;

export function adminNextStep(state: DemoStatus, clientHasVa: boolean): AdminNextStep {
  if (state === "completed") return clientHasVa ? null : "assign_va";
  if (state === "pending") return "await_va_answer";
  if (state === "confirmed") return "call_booked";
  return null;
}
