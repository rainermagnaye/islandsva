import { DEMO_LIMITS, SLOT_TIMES, manilaToIso } from "./contract";

// Which half hours a VA may still offer on a day: not past, not already offered, and not overlapping anything
// already booked (a meeting or a demo call). Shared by the Add slots form (to lock times) and the server (to
// check again on save). Pure, so both sides agree and the rules are tested.

/** Something already in the VA's calendar. ISO instants. */
export type BusyTime = { start: string; end: string; label: string };

export type SlotState = "free" | "offered" | "booked" | "past";
export type SlotCell = { time: string; startsAt: string; state: SlotState; reason: string | null };

const SLOT_MS = DEMO_LIMITS.slotMinutes * 60 * 1000;

/** The booking a 30-minute slot starting at `startsAt` would overlap, if any. Touching ends don't overlap. */
export function overlapping(startsAt: string, busy: readonly BusyTime[]): BusyTime | undefined {
  const from = Date.parse(startsAt);
  const to = from + SLOT_MS;
  return busy.find((item) => Date.parse(item.start) < to && Date.parse(item.end) > from);
}

/** "09:30" → "9:30 am". */
export function slotLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const short = (iso: string) => clock.format(new Date(iso)).replace("AM", "am").replace("PM", "pm");

/** Every start time of a Manila day, with whether it can be picked and why not. */
export function slotCells(date: string, offered: readonly string[], busy: readonly BusyTime[], now: Date): SlotCell[] {
  const taken = new Set(offered.map((iso) => new Date(iso).toISOString()));
  return SLOT_TIMES.map((time) => {
    const startsAt = manilaToIso(date, time);
    if (Date.parse(startsAt) <= now.getTime()) return { time, startsAt, state: "past", reason: "This time has passed" };
    if (taken.has(startsAt)) return { time, startsAt, state: "offered", reason: "You already offer this slot" };
    const clash = overlapping(startsAt, busy);
    if (clash) return { time, startsAt, state: "booked", reason: `${clash.label}, ${short(clash.start)} – ${short(clash.end)}` };
    return { time, startsAt, state: "free", reason: null };
  });
}

/** Free start times inside the VA's working window for that day (ISO weekday 1 = Monday, minutes in Manila). */
export function workingTimes(cells: readonly SlotCell[], date: string, windows: readonly { weekday: number; startMinute: number; endMinute: number }[]): string[] {
  const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const window = windows.find((item) => item.weekday === weekday);
  if (!window) return [];
  return cells
    .filter((cell) => {
      const [hours, minutes] = cell.time.split(":").map(Number);
      const start = hours * 60 + minutes;
      return cell.state === "free" && start >= window.startMinute && start + DEMO_LIMITS.slotMinutes <= window.endMinute;
    })
    .map((cell) => cell.time);
}

/** Splits requested starts into those still free and those now overlapping a booking (with what they hit). */
export function splitFree(startsAt: readonly string[], busy: readonly BusyTime[]) {
  const free: string[] = [];
  const taken: { startsAt: string; busy: BusyTime }[] = [];
  for (const start of startsAt) {
    const clash = overlapping(start, busy);
    if (clash) taken.push({ startsAt: start, busy: clash });
    else free.push(start);
  }
  return { free, taken };
}

/** What blocks a slot: meetings that are requested or scheduled, and demo calls waiting or confirmed. */
export function busyFrom(
  bookings: readonly { title: string; status: string; startsAt: string; endsAt: string; clientName: string | null }[],
  demos: readonly { status: string; startsAt: string; endsAt: string; companyName: string }[],
): BusyTime[] {
  return [
    ...bookings
      .filter((booking) => booking.status === "requested" || booking.status === "scheduled")
      .map((booking) => ({ start: booking.startsAt, end: booking.endsAt, label: booking.clientName ? `${booking.title} · ${booking.clientName}` : booking.title })),
    ...demos
      .filter((demo) => demo.status === "pending" || demo.status === "confirmed")
      .map((demo) => ({ start: demo.startsAt, end: demo.endsAt, label: `${demo.status === "pending" ? "Demo request" : "Demo call"} · ${demo.companyName}` })),
  ];
}
