"use client";

import { useRouter } from "next/navigation";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { wallClockIn } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import type { ScheduleEvent, ScheduleShift } from "@/components/ui/schedule-events";
import type { Tone } from "@/components/ui/tone";
import { BOOKING_TIME_ZONE, type Booking } from "../contract";

const BookingDetail = lazy(() => import("./booking-detail").then((m) => ({ default: m.BookingDetail })));
const VaMeetingCancel = lazy(() => import("./va-meeting-cancel").then((m) => ({ default: m.VaMeetingCancel })));

/**
 * Bookings where this person is the staff member or the client. Read only. A page can add its own events
 * (`extras`; one with an `href` opens that page on click, others go to `onExtraSelect`), shift bands, a legend and
 * header actions. With `ownerId` (the VA), a meeting they booked and that's still open can be cancelled.
 */
export function PersonCalendar({
  bookings,
  today,
  nowMinutes,
  extras = [],
  shifts,
  legend,
  actions,
  showToolbar = false,
  ownerId,
  onExtraSelect,
}: {
  bookings: readonly Booking[];
  today: string;
  nowMinutes: number;
  extras?: readonly { event: ScheduleEvent; href?: string }[];
  shifts?: readonly ScheduleShift[];
  legend?: readonly { tone?: Tone; label: string }[];
  actions?: ReactNode;
  showToolbar?: boolean;
  ownerId?: string;
  onExtraSelect?: (id: string) => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const events: ScheduleEvent[] = bookings.map((booking) => ({
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: booking.status === "cancelled" ? "ocean" : "lagoon",
    pending: booking.status === "requested",
    who: booking.guests.map((guest) => guest.name).join(", ") || booking.clientName || booking.staffName || undefined,
  }));

  const links = new Map(extras.flatMap((extra) => (extra.href ? [[extra.event.id, extra.href] as const] : [])));

  if (bookings.length === 0 && extras.length === 0 && !showToolbar) {
    return <EmptyState compact title="No meetings yet" description="When someone adds you to a meeting, it shows here." />;
  }

  return (
    <>
      <ScheduleCalendar
        showToolbar={showToolbar}
        events={[...events, ...extras.map((extra) => extra.event)]}
        shifts={shifts}
        legend={legend}
        actions={actions}
        today={today}
        nowMinutes={nowMinutes}
        timeZone={BOOKING_TIME_ZONE}
        onEventClick={(event) => {
          const href = links.get(event.id);
          if (href) router.push(href);
          else if (bookings.some((booking) => booking.id === event.id)) setSelectedId(event.id);
          else onExtraSelect?.(event.id);
        }}
      />
      {selected && (
        <Suspense fallback={null}>
          <BookingDetail
            booking={selected}
            canManage={false}
            banner={ownerId && selected.kind === "manual" && selected.createdBy === ownerId && (selected.status === "requested" || selected.status === "scheduled")
              ? <VaMeetingCancel booking={selected} onDone={() => setSelectedId(null)} />
              : undefined}
            onClose={() => setSelectedId(null)}
            onDone={() => undefined}
          />
        </Suspense>
      )}
    </>
  );
}
