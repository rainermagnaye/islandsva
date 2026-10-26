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
