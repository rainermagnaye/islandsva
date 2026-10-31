import { offsetMinutes } from "@/components/ui/date-math";
import type { AssignedClient } from "@/features/clients/contract";
import type { Task, WorkSession } from "@/features/tasks/contract";
import { isOverdue } from "@/features/tasks/metrics";
import { isDelayed, msBetween, packageWeek } from "@/features/tasks/time";

// The VA's client list: one row per client with their local time, this week's hours against the package, and
// open work. Pure, so the page stays a thin read-and-render and the rules are tested here.

/** VAs work from the Philippines; "ahead" and "behind" are said from there. */
export const VA_ZONE = "Asia/Manila";
/** Share of the week's hours at which a client "needs attention" (the progress bar turns amber here too). */
export const NEAR_LIMIT = 0.85;

export type TheirTime = {
  /** "1:00 am" */
  clock: string;
  /** "New York" */
  city: string;
  /** 6 am to 6 pm there. */
  day: boolean;
  /** "Night there · 12 h behind you" */
  line: string;
};

export type ClientRow = {
  id: string;
  company: string;
  contact: string;
  email: string;
  since: string;
  time: TheirTime | null;
  /** Hours worked this week (their Monday to Sunday) and the hours a week agreed; null when none are agreed. */
  hours: { used: number; agreed: number } | null;
  open: number;
  overdue: number;
  delayed: number;
  attention: boolean;
};

export type ClientView = "all" | "attention" | "daytime";

/** A zone Intl knows, or null: a bad stored value must never break the page. */
function knownZone(zone: string | null): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

/** "America/New_York" → "New York"; "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const cityOf = (zone: string) => (zone.split("/").pop() ?? zone).replace(/_/g, " ");

function gapLabel(minutes: number): string {
  if (minutes === 0) return "same time as you";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const size = rest === 0 ? `${hours} h` : hours === 0 ? `${rest} min` : `${hours} h ${rest} min`;
  return `${size} ${minutes > 0 ? "ahead of" : "behind"} you`;
}

/** The client's wall clock now, whether it is daytime there, and how far they are from Manila. */
export function theirTime(zone: string | null, now: Date): TheirTime | null {
  const known = knownZone(zone);
  if (!known) return null;
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: known }).format(now).replace("AM", "am").replace("PM", "pm");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: known }).format(now));
  const day = hour >= 6 && hour < 18;
  const gap = offsetMinutes(known, now) - offsetMinutes(VA_ZONE, now);
  return { clock, city: cityOf(known), day, line: `${day ? "Daytime" : "Night"} there · ${gapLabel(gap)}` };
}

const roundHours = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;
const sinceFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** One row per client, in the order given. Tasks and sessions are the VA's own (RLS), matched by client. */
export function clientRows(clients: readonly AssignedClient[], tasks: readonly Task[], sessions: ReadonlyMap<string, readonly WorkSession[]>, now: Date): ClientRow[] {
  return clients.map((client) => {
    const theirs = tasks.filter((task) => task.clientId === client.id);
    const open = theirs.filter((task) => task.status !== "done");
    const zone = knownZone(client.timezone) ?? VA_ZONE;
    const week = packageWeek(zone, now);
    const weekMs = msBetween(theirs.flatMap((task) => sessions.get(task.id) ?? []), week.start, week.end, now);
    const hours = client.hoursPerWeek ? { used: roundHours(weekMs), agreed: client.hoursPerWeek } : null;
    const overdue = open.filter((task) => isOverdue(task, now)).length;
    const delayed = open.filter((task) => isDelayed(task.durationMinutes, sessions.get(task.id) ?? [], now)).length;
    const time = theirTime(client.timezone, now);
    return {
      id: client.id,
      company: client.companyName,
      contact: client.contactName,
      email: client.contactEmail,
      since: sinceFormat.format(new Date(client.startedAt)),
      time,
      hours,
      open: open.length,
      overdue,
      delayed,
      attention: overdue > 0 || delayed > 0 || time === null || hours === null || hours.used >= hours.agreed * NEAR_LIMIT,
    };
  });
}

/** The URL's ?view=, or "all". */
export const viewOf = (value: string | string[] | undefined): ClientView => (value === "attention" || value === "daytime" ? value : "all");

/** Rows matching the search (company or contact, any case) and the view. */
export function filterRows(rows: readonly ClientRow[], query: string, view: ClientView): ClientRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (q === "" || row.company.toLowerCase().includes(q) || row.contact.toLowerCase().includes(q)) &&
      (view === "all" || (view === "attention" ? row.attention : row.time?.day === true)),
  );
}
