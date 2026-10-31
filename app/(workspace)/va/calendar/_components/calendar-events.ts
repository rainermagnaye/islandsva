import { wallClockIn } from "@/components/ui/date-math";
import type { ScheduleEvent, ScheduleShift } from "@/components/ui/schedule-events";
import type { Tone } from "@/components/ui/tone";
import { deadlineEvent, type DeadlineSource } from "@/features/tasks/deadline-event";

const SLOT_MS = 30 * 60 * 1000;

export type CalendarExtra = { event: ScheduleEvent; href?: string };

/** The id a to-do block has on the calendar, so a click can offer to remove it. */
export const BLOCK_PREFIX = "block:";

type Demo = { id: string; status: string; startsAt: string; endsAt: string; companyName: string };
type Slot = { id: string; startsAt: string; booking: unknown };
type Window = { weekday: number; startMinute: number; endMinute: number };
type Block = { id: string; taskId: string | null; title: string; companyName: string | null; startsAt: string; endsAt: string };

const clock = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * What the VA's calendar shows beside meetings: demo requests (dashed) and calls, open demo slots, the deadlines
 * of open tasks, and the time the VA blocked (on a task, which opens it, or a to-do of their own), all in
 * `timeZone`. A slot with a booking is already shown as its demo.
 */
export function calendarExtras(
  { demos, slots, tasks, blocks = [] }: { demos: readonly Demo[]; slots: readonly Slot[]; tasks: readonly DeadlineSource[]; blocks?: readonly Block[] },
  timeZone: string,
  taskHref: (id: string) => string,
): CalendarExtra[] {
  const demoEvents = demos
    .filter((demo) => demo.status === "pending" || demo.status === "confirmed")
    .map((demo) => ({
      event: {
        id: `demo:${demo.id}`,
        title: demo.status === "pending" ? `Demo request · ${demo.companyName}` : `Demo call · ${demo.companyName}`,
        start: wallClockIn(demo.startsAt, timeZone),
        end: wallClockIn(demo.endsAt, timeZone),
        tone: "lagoon" as Tone,
        pending: demo.status === "pending",
      },
    }));
  const slotEvents = slots
    .filter((slot) => slot.booking === null)
    .map((slot) => ({
      event: {
        id: `slot:${slot.id}`,
        title: "Open demo slot",
        start: wallClockIn(slot.startsAt, timeZone),
        end: wallClockIn(new Date(Date.parse(slot.startsAt) + SLOT_MS).toISOString(), timeZone),
        tone: "sand" as Tone,
      },
    }));
  const taskEvents = tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const event = deadlineEvent(task, timeZone);
      return { event: { ...event, title: `Due: ${task.title}`, who: undefined }, href: taskHref(task.id) };
    });
  const blockEvents = blocks.map((block) => ({
    event: {
      id: block.taskId ? `taskblock:${block.id}` : `${BLOCK_PREFIX}${block.id}`,
      title: block.taskId ? `Work: ${block.title}` : block.title,
      start: wallClockIn(block.startsAt, timeZone),
      end: wallClockIn(block.endsAt, timeZone),
      tone: "coral" as Tone,
      who: block.companyName ?? "To-do",
    },
    href: block.taskId ? taskHref(block.taskId) : undefined,
  }));
  return [...demoEvents, ...slotEvents, ...taskEvents, ...blockEvents];
}

/**
 * Working hours as shift bands. Windows are ISO weekdays (1 = Monday) in Manila minutes; the calendar's days are
 * 0 = Sunday. A window starting between 6 am and 6 pm is a day shift, otherwise a night shift.
 */
export function workingShifts(windows: readonly Window[]): ScheduleShift[] {
  return windows.map((window) => ({
    kind: window.startMinute >= 360 && window.startMinute < 1080 ? "day" : "night",
    start: clock(window.startMinute),
    end: clock(window.endMinute),
    label: "Working hours",
    days: [window.weekday % 7],
  }));
}

export const CALENDAR_LEGEND: readonly { tone: Tone; label: string }[] = [
  { tone: "lagoon", label: "Meetings and demos" },
  { tone: "sand", label: "Open demo slots" },
  { tone: "coral", label: "Tasks, deadlines and to-dos" },
];
