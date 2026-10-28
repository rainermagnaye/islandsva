"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { wallClockIn, type IsoDate } from "@/components/ui/date-math";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { clientTaskHref } from "@/content/routes";
import { DemoCalendar } from "@/features/demos/components/demo-calendar";
import { deadlineEvent, taskIdFromEvent, type DeadlineSource } from "@/features/tasks/deadline-event";
import { BOOKING_TIME_ZONE, type Booking } from "../contract";
import { BookingDetail } from "./booking-detail";

const LEGEND = [
  { tone: "sand" as const, label: "Requested" },
  { tone: "lagoon" as const, label: "Confirmed" },
  { done: true, label: "Completed" },
  { tone: "ocean" as const, label: "Cancelled" },
  { tone: "coral" as const, label: "Deadline" },
];

function bookingEvents(bookings: readonly Booking[]): ScheduleEvent[] {
  return bookings.map((booking) => ({
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: booking.status === "cancelled" ? "ocean" : booking.status === "requested" ? "sand" : "lagoon",
    pending: booking.status === "requested",
    done: booking.status === "done",
    who: booking.guests.map((guest) => guest.name).join(", ") || booking.clientName || booking.staffName || undefined,
  }));
}

/** The admin calendar, read-only: this client's meetings and their task deadlines. */
export function ClientCalendar({
  bookings,
  tasks,
  now,
  today,
  nowMinutes,
}: {
  bookings: readonly Booking[];
  tasks: readonly DeadlineSource[];
  now: string;
  today: IsoDate;
  nowMinutes: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;

  return (
    <>
      <DemoCalendar
        rows={[]}
        now={now}
        today={today}
        nowMinutes={nowMinutes}
        extraEvents={[...bookingEvents(bookings), ...tasks.map((task) => deadlineEvent(task, BOOKING_TIME_ZONE))]}
        legend={LEGEND}
        onEventClick={(event) => {
          const taskId = taskIdFromEvent(event.id);
          if (taskId) {
            router.push(clientTaskHref(taskId));
            return true;
          }
          if (!bookings.some((booking) => booking.id === event.id)) return true;
          setSelectedId(event.id);
          return true;
        }}
      />
      {selected && <BookingDetail booking={selected} canManage={false} onClose={() => setSelectedId(null)} onEdit={() => undefined} onDone={() => undefined} />}
    </>
  );
}
