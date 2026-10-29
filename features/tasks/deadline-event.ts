import { addDays, instantInZone, minutesOf, wallClockIn, type IsoLocalDateTime } from "@/components/ui/date-math";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { TASK_FALLBACK_TIMEZONE, type TaskStatus } from "./contract";

const TASK_PREFIX = "task:";
const SLOT_MINUTES = 30;

export type DeadlineSource = {
  id: string;
  title: string;
  vaFirstName: string;
  deadline: string;
  deadlineTime: string | null;
  deadlineTimezone: string;
  status: TaskStatus;
};

/** The calendar id for a task deadline, so a click can open that task. */
export const deadlineEventId = (taskId: string) => `${TASK_PREFIX}${taskId}`;

export function taskIdFromEvent(eventId: string) {
  return eventId.startsWith(TASK_PREFIX) ? eventId.slice(TASK_PREFIX.length) : null;
}

function addMinutes(local: IsoLocalDateTime, minutes: number): IsoLocalDateTime {
  const date = local.slice(0, 10);
  const total = minutesOf(local) + minutes;
  const days = Math.floor(total / (24 * 60));
  const rest = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(rest / 60)).padStart(2, "0");
  const mins = String(rest % 60).padStart(2, "0");
  return `${addDays(date, days)}T${hours}:${mins}`;
}

/** A task deadline as a 30-minute block on the calendar, in the viewer's zone. */
export function deadlineEvent(task: DeadlineSource, timeZone: string): ScheduleEvent {
  const zone = task.deadlineTimezone || TASK_FALLBACK_TIMEZONE;
  const clock = task.deadlineTime ?? "23:30";
  const start = wallClockIn(instantInZone(task.deadline, clock, zone), timeZone);
  return {
    id: deadlineEventId(task.id),
    title: task.title,
    start,
    end: addMinutes(start, SLOT_MINUTES),
    tone: "coral",
    who: task.vaFirstName,
    done: task.status === "done",
  };
}
