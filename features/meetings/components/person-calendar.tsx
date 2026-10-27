"use client";

import { useState } from "react";
import { wallClockIn } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { BOOKING_TIME_ZONE, type Booking } from "../contract";
import { BookingDetail } from "./booking-detail";

/** Bookings where this person is the staff member or the client. Read only. */
export function PersonCalendar({ bookings, today, nowMinutes }: { bookings: readonly Booking[]; today: string; nowMinutes: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const events: ScheduleEvent[] = bookings.map((booking) => ({
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: booking.status === "cancelled" ? "ocean" : "lagoon",
    who: booking.guests.map((guest) => guest.name).join(", ") || booking.clientName || booking.staffName || undefined,
  }));

  if (bookings.length === 0) {
    return <EmptyState compact title="No meetings yet" description="When someone adds you to a meeting, it shows here." />;
  }

  return (
    <>
      <ScheduleCalendar showToolbar={false} events={events} today={today} nowMinutes={nowMinutes} timeZone={BOOKING_TIME_ZONE} onEventClick={(event) => setSelectedId(event.id)} />
      {selected && (
        <BookingDetail booking={selected} canManage={false} onClose={() => setSelectedId(null)} onEdit={() => undefined} onDone={() => undefined} />
      )}
    </>
  );
}
