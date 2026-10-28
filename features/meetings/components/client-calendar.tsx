"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { wallClockIn, type IsoDate } from "@/components/ui/date-math";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { appRoutes, clientTaskHref } from "@/content/routes";
import { DemoCalendar } from "@/features/demos/components/demo-calendar";
import { deadlineEvent, taskIdFromEvent, type DeadlineSource } from "@/features/tasks/deadline-event";
import type { AgendaItem, AgendaKind } from "../agenda";
import { clientGesture, draftFrom, draftOf, ownMeeting, type BookingDraft } from "../booking-draft";
import { BOOKING_TIME_ZONE, type Booking, type BookingChoice } from "../contract";
import type { ScheduleRow } from "../schedule";
import { BookingDetail } from "./booking-detail";
import { BookingForm } from "./booking-form";
import { placeBooking } from "./client-moves";
import { ScheduleTable } from "./schedule-table";
import { ComingUp } from "./coming-up";

/** One of the client's demo calls, as the calendar draws it. */
export type CalendarDemo = { id: string; vaName: string; startsAt: string; endsAt: string; state: "pending" | "confirmed" | "completed" };

const DEMO_PREFIX = "demo:";
const KINDS: readonly { kind: AgendaKind; label: string }[] = [
  { kind: "deadline", label: "Task deadlines" },
  { kind: "meeting", label: "Meetings" },
  { kind: "demo", label: "Demo calls" },
];

const who = (booking: Booking) => booking.guests.map((guest) => guest.name).join(", ") || booking.staffName || booking.clientName || undefined;

/** Meetings in ocean, apart from demo calls (lagoon) and deadlines (coral). A cancelled one stays in the table only. */
function bookingEvents(bookings: readonly Booking[]): ScheduleEvent[] {
  return bookings.filter((booking) => booking.status !== "cancelled").map((booking) => ({
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: "ocean",
    pending: booking.status === "requested",
    done: booking.status === "done",
    who: who(booking),
  }));
}

function demoEvents(demos: readonly CalendarDemo[]): ScheduleEvent[] {
  return demos.map((demo) => ({
    id: `${DEMO_PREFIX}${demo.id}`,
    title: `Demo call with ${demo.vaName}`,
    start: wallClockIn(demo.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(demo.endsAt, BOOKING_TIME_ZONE),
    tone: "lagoon",
    pending: demo.state === "pending",
    done: demo.state === "completed",
    who: demo.vaName,
  }));
}

/**
 * The client's calendar: their meetings, demo calls and task deadlines, a filter by kind and by assistant,
 * "Coming up" beside it, and everything as one "Schedules" table below. "New meeting" or a click on an empty slot books a
 * meeting with their assistants; their own meetings move and stretch on the grid.
 */
export function ClientCalendar({
  bookings,
  tasks,
  demos,
  agenda,
  schedule,
  review,
  team,
  userId,
  now,
  today,
  nowMinutes,
}: {
  bookings: readonly Booking[];
  tasks: readonly DeadlineSource[];
  demos: readonly CalendarDemo[];
  agenda: readonly AgendaItem[];
  schedule: readonly ScheduleRow[];
  review: { count: number; href: string } | null;
  /** The client's assistants on an active assignment (id, first name). */
  team: readonly BookingChoice[];
  userId: string;
  now: string;
  today: IsoDate;
  nowMinutes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const assistants = team.map((member) => member.label);
  const [hidden, setHidden] = useState<readonly AgendaKind[]>([]);
  const [assistant, setAssistant] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;

  const shows = (kind: AgendaKind, names: string | null | undefined) =>
    !hidden.includes(kind) && (assistant === null || (names ?? "").split(", ").some((name) => name.trim().split(/\s+/)[0] === assistant));
  const events = [
    ...bookingEvents(bookings).filter((event) => shows("meeting", event.who)),
    ...demoEvents(demos).filter((event) => shows("demo", event.who)),
    ...tasks.filter((task) => shows("deadline", task.vaFirstName)).map((task) => deadlineEvent(task, BOOKING_TIME_ZONE)),
  ];
  const items = agenda.filter((item) => shows(item.kind, item.who));
  const active = hidden.length + (assistant ? 1 : 0);

  const filterItems: MenuItem[] = [
    ...KINDS.map(({ kind, label }) => ({
      label,
      icon: hidden.includes(kind) ? undefined : ("check" as const),
      onSelect: () => setHidden((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind])),
    })),
    { separator: true },
    { label: "All assistants", icon: assistant === null ? ("check" as const) : undefined, onSelect: () => setAssistant(null) },
    ...assistants.map((name) => ({ label: name, icon: assistant === name ? ("check" as const) : undefined, onSelect: () => setAssistant(name) })),
  ];

  function open(id: string) {
    setDraft(null);
    setEditing(false);
    setSelectedId(id);
  }

  function book(day: IsoDate, minute: number) {
    setSelectedId(null);
    setEditing(false);
    setDraft(draftFrom(day, minute));
  }

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    setDraft(null);
    setEditing(false);
    if (message === "Meeting cancelled.") setSelectedId(null);
  }

  return (
    <>
      <DemoCalendar
        rows={[]}
        now={now}
        today={today}
        nowMinutes={nowMinutes}
        extraEvents={events}
        legend={[]}
        actions={<Button type="button" iconLeft="plus" onClick={() => book(today, 9 * 60)}>New meeting</Button>}
        onSlotClick={book}
        eventGesture={(event) => clientGesture(bookings.find((booking) => booking.id === event.id), userId)}
        onEventMove={(event, next) => {
          const booking = bookings.find((item) => item.id === event.id);
          if (!booking) return false;
          return placeBooking(booking, next, (message, tone) => toast.show({ title: message, tone }));
        }}
        toolbar={
          <span className="relative inline-flex">
            <DropdownMenu label={active ? `Filter, ${active} active` : "Filter"} icon="filter" iconOnly variant="plain" align="end" items={filterItems} />
            {active > 0 && <span aria-hidden="true" className="pointer-events-none absolute -top-1 -right-1 grid size-4 place-items-center rounded-pill bg-action-primary type-caption font-bold text-on-action-primary">{active}</span>}
          </span>
        }
        aside={<ComingUp items={items} review={review} onOpenBooking={open} />}
        onEventClick={(event) => {
          const taskId = taskIdFromEvent(event.id);
          if (taskId) {
            router.push(clientTaskHref(taskId));
            return true;
          }
          if (event.id.startsWith(DEMO_PREFIX)) {
            router.push(appRoutes.clientMatch);
            return true;
          }
          if (bookings.some((booking) => booking.id === event.id)) open(event.id);
          return true;
        }}
      />
      <ScheduleTable rows={schedule} onOpenBooking={open} />
      {draft && (
        <BookingForm mode="create" audience="client" draft={draft} clients={[]} staff={team} creatorName="You" onClose={() => setDraft(null)} onDone={() => done("Meeting added.")} />
      )}
      {selected && !editing && (
        <BookingDetail
          booking={selected}
          canManage={ownMeeting(selected, userId)}
          audience="client"
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(true)}
          onDone={done}
        />
      )}
      {selected && editing && (
        <BookingForm
          mode="edit"
          audience="client"
          booking={selected}
          draft={draftOf(selected)}
          clients={[]}
          staff={team}
          creatorName="You"
          onClose={() => setEditing(false)}
          onDone={() => done("Meeting saved.")}
        />
      )}
    </>
  );
}
