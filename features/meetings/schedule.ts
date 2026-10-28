import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type TaskStatus } from "@/features/tasks/contract";
import { BOOKING_STATUS_LABELS, type Booking } from "./contract";

// The client calendar's "Schedules" table: meetings, task deadlines and demo calls in one list, newest first.

export type ScheduleKind = "meeting" | "task" | "demo";
export type ScheduleTone = "neutral" | "info" | "warning" | "success" | "danger";

export type ScheduleRow = {
  key: string;
  kind: ScheduleKind;
  title: string;
  /** Start of a meeting or demo call; a task's deadline. */
  at: string;
  /** End of a meeting or demo call; null for a task. */
  end: string | null;
  who: string;
  status: { label: string; tone: ScheduleTone };
  /** Where the row leads: a task or VA Match. Null for a meeting, which opens its details in place. */
  href: string | null;
  bookingId: string | null;
};

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = { meeting: "Meeting", task: "Task", demo: "Demo call" };

export type ScheduleTask = { id: string; title: string; vaFirstName: string; at: string; status: TaskStatus; overdue: boolean; href: string };
export type ScheduleDemo = { id: string; vaName: string; startsAt: string; endsAt: string; state: "pending" | "confirmed" | "completed"; href: string };

const MEETING_TONES: Record<Booking["status"], ScheduleTone> = { requested: "warning", scheduled: "success", done: "info", cancelled: "neutral" };
const DEMO_STATUS: Record<ScheduleDemo["state"], { label: string; tone: ScheduleTone }> = {
  pending: { label: "Requested", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  completed: { label: "Completed", tone: "info" },
};

function staffOf(booking: Booking) {
  const names = booking.guests.filter((guest) => guest.kind === "staff").map((guest) => guest.name);
  return names.length > 0 ? names.join(", ") : booking.staffName ?? "Islands VA";
}

export function scheduleRows({ bookings, tasks, demos }: { bookings: readonly Booking[]; tasks: readonly ScheduleTask[]; demos: readonly ScheduleDemo[] }): ScheduleRow[] {
  const rows: ScheduleRow[] = [
    ...bookings.map((booking): ScheduleRow => ({
      key: `meeting:${booking.id}`,
      kind: "meeting",
      title: booking.title,
      at: booking.startsAt,
      end: booking.endsAt,
      who: staffOf(booking),
      status: { label: BOOKING_STATUS_LABELS[booking.status], tone: MEETING_TONES[booking.status] },
      href: null,
      bookingId: booking.id,
    })),
    ...tasks.map((task): ScheduleRow => ({
      key: `task:${task.id}`,
      kind: "task",
      title: task.title,
      at: task.at,
      end: null,
      who: task.vaFirstName,
      status: task.overdue ? { label: "Overdue", tone: "danger" } : { label: TASK_STATUS_LABELS[task.status], tone: TASK_STATUS_TONES[task.status] },
      href: task.href,
      bookingId: null,
    })),
    ...demos.map((demo): ScheduleRow => ({
      key: `demo:${demo.id}`,
      kind: "demo",
      title: `Demo call with ${demo.vaName}`,
      at: demo.startsAt,
      end: demo.endsAt,
      who: demo.vaName,
      status: DEMO_STATUS[demo.state],
      href: demo.href,
      bookingId: null,
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}
