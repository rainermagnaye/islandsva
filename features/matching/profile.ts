import { clockLabel, offsetMinutes } from "@/components/ui/date-math";

// The work profile a client sees of an offered VA (offered_va_profiles). Pure, so it is tested without a database.

export type OfferedProfile = {
  vaId: string;
  firstName: string;
  /** The latest role, as a one-line specialty. Null when the VA listed none. */
  headline: string | null;
  skills: string[];
  languages: string | null;
  education: string | null;
  certifications: string | null;
  employers: { position: string; company: string; duration: string }[];
  responsibilities: string | null;
  achievements: string | null;
  hours: { weekday: number; start: number; end: number }[];
};

type Row = {
  va_id: string;
  first_name: string;
  skills: string | null;
  languages: string | null;
  highest_education: string | null;
  certifications: string | null;
  employers: unknown;
  key_responsibilities: string | null;
  achievements: string | null;
  working_hours: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const filled = (value: string | null) => (value && value.trim() ? value.trim() : null);

/** One row as the page uses it. Anything malformed in the JSON is dropped rather than shown. */
export function toProfile(row: Row): OfferedProfile {
  const employers = (Array.isArray(row.employers) ? row.employers : [])
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({ position: text(entry.position), company: text(entry.company), duration: text(entry.duration) }))
    .filter((entry) => entry.position || entry.company);
  const hours = (Array.isArray(row.working_hours) ? row.working_hours : [])
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .filter((entry) => Number.isInteger(entry.weekday) && Number.isInteger(entry.start) && Number.isInteger(entry.end))
    .map((entry) => ({ weekday: entry.weekday as number, start: entry.start as number, end: entry.end as number }))
    .sort((a, b) => a.weekday - b.weekday);
  return {
    vaId: row.va_id,
    firstName: row.first_name,
    headline: employers[0]?.position || null,
    skills: (row.skills ?? "")
      .split(/[,\n;]/)
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 12),
    languages: filled(row.languages),
    education: filled(row.highest_education),
    certifications: filled(row.certifications),
    employers,
    responsibilities: filled(row.key_responsibilities),
    achievements: filled(row.achievements),
    hours,
  };
}

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MANILA_OFFSET = 480;

/**
 * The VA's week in a line: "Mon–Fri · 9:00 AM–6:00 PM". Days in a row with the same times are joined; a week with
 * several patterns lists each. `shift` moves the times by that many minutes (for the viewer's zone).
 */
function summarize(hours: OfferedProfile["hours"], shift: number) {
  const groups: { from: number; to: number; start: number; end: number }[] = [];
  for (const window of hours) {
    const last = groups.at(-1);
    if (last && last.to === window.weekday - 1 && last.start === window.start && last.end === window.end) last.to = window.weekday;
    else groups.push({ from: window.weekday, to: window.weekday, start: window.start, end: window.end });
  }
  const clock = (minute: number) => clockLabel((((minute + shift) % 1440) + 1440) % 1440);
  return groups
    .map((group) => `${group.from === group.to ? DAYS[group.from] : `${DAYS[group.from]}–${DAYS[group.to]}`} · ${clock(group.start)}–${clock(group.end)}`)
    .join(", ");
}

/**
 * The working hours in Manila and, when the viewer is elsewhere, the same times in the viewer's zone. The viewer's
 * line is given only for one pattern of times (a shift past midnight would move the days too). Null without hours.
 */
export function hoursSummary(hours: OfferedProfile["hours"], viewerZone: string, now = new Date()): { manila: string; yours: string | null } | null {
  if (hours.length === 0) return null;
  const shift = offsetMinutes(viewerZone, now) - MANILA_OFFSET;
  const oneTime = hours.every((window) => window.start === hours[0].start && window.end === hours[0].end);
  const yours = shift === 0 || !oneTime ? null : `${summarize([hours[0]], shift).replace(/^[^·]+· /, "")} your time`;
  return { manila: `${summarize(hours, 0)} Manila`, yours };
}
