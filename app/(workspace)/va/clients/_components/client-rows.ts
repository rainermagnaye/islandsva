import { offsetMinutes } from "@/components/ui/date-math";
import type { AssignedClient } from "@/features/clients/contract";
import type { Task } from "@/features/tasks/contract";
import { isOverdue } from "@/features/tasks/metrics";

// The VA's client list: one row per client with their local time, the package's weekly hours, and open work. Pure, so the page stays a thin read-and-render and the rules are tested here.

/** VAs work from the Philippines; "ahead" and "behind" are said from there. */
export const VA_ZONE = "Asia/Manila";

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
  /** The hours a week agreed; null when none are. Hours worked come with timesheets (M14). */
  hoursPerWeek: number | null;
  open: number;
  overdue: number;
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

const sinceFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** One row per client, in the order given. Tasks are the VA's own (RLS), matched by client. */
export function clientRows(clients: readonly AssignedClient[], tasks: readonly Task[], now: Date): ClientRow[] {
  return clients.map((client) => {
    const theirs = tasks.filter((task) => task.clientId === client.id);
    const open = theirs.filter((task) => task.status !== "done");
    const hoursPerWeek = client.hoursPerWeek || null;
    const overdue = open.filter((task) => isOverdue(task, now)).length;
    const time = theirTime(client.timezone, now);
    return {
      id: client.id,
      company: client.companyName,
      contact: client.contactName,
      email: client.contactEmail,
      since: sinceFormat.format(new Date(client.startedAt)),
      time,
      hoursPerWeek,
      open: open.length,
      overdue,
      attention: overdue > 0 || time === null || hoursPerWeek === null,
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
