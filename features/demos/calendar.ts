import { wallClockIn } from "@/components/ui/date-math";
import type { Tone } from "@/components/ui/tone";
import { VA_TIME_ZONE, demoState, type DemoStatus } from "./contract";

/** One booking drawn on the admin week calendar. Times stay UTC until the view converts them. */
export type DemoCalendarRow = {
  id: string;
  clientId: string;
  companyName: string;
  vaName: string;
  status: DemoStatus;
  startsAt: string;
  endsAt: string;
};

const TONE: Record<DemoStatus, Tone> = {
  pending: "sand",
  expired: "sand",
  confirmed: "lagoon",
  completed: "lagoon",
  rejected: "coral",
  cancelled: "ocean",
};

/** Bookings as week-calendar events in the VA's zone. A past request reads as expired, a finished call as completed. */
export function demoCalendarEvents(rows: readonly DemoCalendarRow[], now = new Date()) {
  return rows.map((row) => ({
    id: row.id,
    title: row.companyName,
    who: row.vaName,
    start: wallClockIn(row.startsAt, VA_TIME_ZONE),
    end: wallClockIn(row.endsAt, VA_TIME_ZONE),
    tone: TONE[demoState(row, now)],
  }));
}
