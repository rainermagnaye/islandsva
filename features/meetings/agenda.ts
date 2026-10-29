import { clockLabel, minutesOf, todayIn, wallClockIn } from "@/components/ui/date-math";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES } from "@/features/tasks/contract";
import type { Booking } from "./contract";
import type { ScheduleDemo, ScheduleTask } from "./schedule";

// "Coming up" on the client's calendar: what is overdue, then the next two weeks of deadlines, meetings and demo
// calls, grouped by day in the client's zone. Pure, so it is tested without a database or a clock.

export type AgendaKind = "deadline" | "meeting" | "demo";

export type AgendaSource = {
  key: string;
  kind: AgendaKind;
  title: string;
  /** ISO instant: a meeting's start, or a task's deadline. */
  at: string;
  /** ISO instant a meeting or call ends. Null for a deadline. */
  end: string | null;
  /** The VA (or VAs) involved, for the line under the title and the assistant filter. */
  who: string | null;
  overdue: boolean;
  badge: { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" } | null;
  href: string | null;
  bookingId: string | null;
};

export type AgendaItem = Omit<AgendaSource, "at" | "end" | "overdue"> & {
  /** "Overdue", "Today", "Tomorrow" or "Fri, Oct 30". */
  group: string;
  /** The day it falls on in the client's zone, YYYY-MM-DD. */
  date: string;
  /** "Due 2:30 pm · Lia", "1 pm–1:30 pm", or with the date first when overdue. */
  when: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const calendarDateIn = (instant: Date, timeZone: string) => todayIn(timeZone, instant);
/** "2:30 pm": an instant's wall-clock time in a zone, in the app's clock style. */
const clockAt = (iso: string, timeZone: string) => clockLabel(minutesOf(wallClockIn(iso, timeZone)));

/** Overdue first (oldest first), then everything from now through `days` ahead, soonest first. */
export function agenda(sources: readonly AgendaSource[], timeZone: string, now: Date, days = 14): AgendaItem[] {
  const today = calendarDateIn(now, timeZone);
  const tomorrow = calendarDateIn(new Date(now.getTime() + DAY_MS), timeZone);
  const until = now.getTime() + days * DAY_MS;
  const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });

  return sources
    .filter((source) => source.overdue || ((source.end ? Date.parse(source.end) : Date.parse(source.at)) >= now.getTime() && Date.parse(source.at) <= until))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || Date.parse(a.at) - Date.parse(b.at) || a.key.localeCompare(b.key))
    .map((source) => {
      const date = calendarDateIn(new Date(source.at), timeZone);
      const group = source.overdue ? "Overdue" : date === today ? "Today" : date === tomorrow ? "Tomorrow" : dayLabel.format(new Date(source.at));
      const time = source.end ? `${clockAt(source.at, timeZone)}–${clockAt(source.end, timeZone)}` : `Due ${clockAt(source.at, timeZone)}`;
      const when = [source.overdue ? dayLabel.format(new Date(source.at)) : null, time, source.kind === "deadline" ? source.who : null].filter(Boolean).join(" · ");
      return { key: source.key, kind: source.kind, title: source.title, who: source.who, badge: source.badge, href: source.href, bookingId: source.bookingId, group, date, when };
    });
}

/**
 * What the client's "Coming up" lists: tasks not closed yet (with an Overdue or status badge), meetings that are
 * still on, and demo calls still to happen.
 */
export function clientAgendaSources({ bookings, tasks, demos }: { bookings: readonly Booking[]; tasks: readonly ScheduleTask[]; demos: readonly ScheduleDemo[] }): AgendaSource[] {
  return [
    ...tasks
      .filter((task) => task.status !== "done")
      .map((task): AgendaSource => ({
        key: `task:${task.id}`,
        kind: "deadline",
        title: task.title,
        at: task.at,
        end: null,
        who: task.vaFirstName,
        overdue: task.overdue,
        badge: task.overdue ? { label: "Overdue", tone: "danger" } : { label: TASK_STATUS_LABELS[task.status], tone: TASK_STATUS_TONES[task.status] },
        href: task.href,
        bookingId: null,
      })),
    ...bookings
      .filter((booking) => booking.status === "requested" || booking.status === "scheduled")
      .map((booking): AgendaSource => ({
        key: `meeting:${booking.id}`,
        kind: "meeting",
        title: booking.title,
        at: booking.startsAt,
        end: booking.endsAt,
        who: booking.guests.filter((guest) => guest.kind === "staff").map((guest) => guest.name).join(", ") || booking.staffName,
        overdue: false,
        badge: booking.status === "requested" ? { label: "Requested", tone: "warning" } : null,
        href: null,
        bookingId: booking.id,
      })),
    ...demos
      .filter((demo) => demo.state !== "completed")
      .map((demo): AgendaSource => ({
        key: `demo:${demo.id}`,
        kind: "demo",
        title: `Demo call with ${demo.vaName}`,
        at: demo.startsAt,
        end: demo.endsAt,
        who: demo.vaName,
        overdue: false,
        badge: demo.state === "pending" ? { label: "Requested", tone: "info" } : { label: "Confirmed", tone: "success" },
        href: demo.href,
        bookingId: null,
      })),
  ];
}

/**
 * The VA's calls for the dashboard's schedule: meetings still on and confirmed demo calls. Demo requests still
 * waiting for an answer are left out — the dashboard lists them separately, with their buttons.
 */
export function vaAgendaSources({
  bookings,
  demos,
}: {
  bookings: readonly Booking[];
  demos: readonly { id: string; status: string; companyName: string; startsAt: string; endsAt: string }[];
}): AgendaSource[] {
  return [
    ...bookings
      .filter((booking) => booking.status === "requested" || booking.status === "scheduled")
      .map((booking): AgendaSource => ({
        key: `meeting:${booking.id}`,
        kind: "meeting",
        title: booking.title,
        at: booking.startsAt,
        end: booking.endsAt,
        who: booking.clientName,
        overdue: false,
        badge: booking.status === "requested" ? { label: "Requested", tone: "warning" } : null,
        href: null,
        bookingId: booking.id,
      })),
    ...demos
      .filter((demo) => demo.status === "confirmed")
      .map((demo): AgendaSource => ({
        key: `demo:${demo.id}`,
        kind: "demo",
        title: `Demo call with ${demo.companyName}`,
        at: demo.startsAt,
        end: demo.endsAt,
        who: demo.companyName,
        overdue: false,
        badge: null,
        href: null,
        bookingId: null,
      })),
  ];
}
