"use client";

import { useRouter } from "next/navigation";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { wallClockIn } from "@/components/ui/date-math";
import { useToast } from "@/components/ui/toast";
import { staffGesture } from "@/features/meetings/booking-draft";
import { ComingUp } from "@/features/meetings/components/coming-up";
import { BOOKING_TIME_ZONE, type Booking } from "@/features/meetings/contract";
import type { AgendaItem } from "@/features/meetings/agenda";
import type { ScheduleRow } from "@/features/meetings/schedule";
import { BLOCK_PREFIX, CALENDAR_LEGEND, type CalendarExtra } from "./calendar-events";

// Calendar grid and schedules list stay off the first-load script; they match the Lead Gen calendar's split.
const DemoCalendar = lazy(() => import("@/features/demos/components/demo-calendar").then((m) => ({ default: m.DemoCalendar })));
const ScheduleTable = lazy(() => import("@/features/meetings/components/schedule-table").then((m) => ({ default: m.ScheduleTable })));
const BookingDetail = lazy(() => import("@/features/meetings/components/booking-detail").then((m) => ({ default: m.BookingDetail })));
const VaMeetingCancel = lazy(() => import("@/features/meetings/components/va-meeting-cancel").then((m) => ({ default: m.VaMeetingCancel })));
const RemoveBlockDialog = lazy(() => import("./remove-block-dialog").then((m) => ({ default: m.RemoveBlockDialog })));

/**
 * The VA calendar in the same frame as the client's: day, week or month, Coming up beside it, and the
 * Schedules list below. Booking, demo requests, slots and removing a to-do stay the VA's own actions.
 */
export function VaCalendarView({
  bookings,
  extras,
  agenda,
  schedule,
  today,
  now,
  nowMinutes,
  ownerId,
  actions,
  tools,
}: {
  bookings: readonly Booking[];
  extras: readonly CalendarExtra[];
  agenda: readonly AgendaItem[];
  schedule: readonly ScheduleRow[];
  today: string;
  now: string;
  nowMinutes: number;
  ownerId: string;
  actions: ReactNode;
  tools: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const block = extras.find((extra) => extra.event.id === `${BLOCK_PREFIX}${blockId}`)?.event ?? null;
  const links = new Map(extras.flatMap((extra) => (extra.href ? [[extra.event.id, extra.href] as const] : [])));
  const events = [
    ...bookings
      .filter((booking) => booking.status !== "cancelled")
      .map((booking) => ({
        id: booking.id,
        title: booking.title,
        start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
        end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
        tone: "lagoon" as const,
        pending: booking.status === "requested",
        done: booking.status === "done",
        who: booking.guests.map((guest) => guest.name).join(", ") || booking.clientName || booking.staffName || undefined,
      })),
    ...extras.map((extra) => extra.event),
  ];

  function open(id: string) {
    setBlockId(null);
    setSelectedId(id);
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-[32rem] rounded-xl bg-surface-sunken" aria-hidden />}>
        <DemoCalendar
          rows={[]}
          now={now}
          today={today}
          nowMinutes={nowMinutes}
          extraEvents={events}
          legend={CALENDAR_LEGEND}
          viewsInHeader
          actions={actions}
          aside={
            <>
              <div className="shrink-0">{tools}</div>
              <ComingUp className="min-h-0 flex-1" items={agenda} review={null} onOpenBooking={open} />
            </>
          }
          eventGesture={(event) => staffGesture(bookings.find((booking) => booking.id === event.id))}
          onEventMove={async (event, next) => {
            const booking = bookings.find((item) => item.id === event.id);
            if (!booking) return false;
            const { placeStaffBooking } = await import("@/features/meetings/components/staff-moves");
            return placeStaffBooking(booking, next, (message, tone) => toast.show({ title: message, tone }));
          }}
          onEventClick={(event) => {
            const href = links.get(event.id);
            if (href) {
              router.push(href);
              return true;
            }
            if (event.id.startsWith(BLOCK_PREFIX)) {
              setSelectedId(null);
              setBlockId(event.id.slice(BLOCK_PREFIX.length));
              return true;
            }
            if (bookings.some((booking) => booking.id === event.id)) open(event.id);
            return true;
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ScheduleTable rows={schedule} onOpenBooking={open} />
      </Suspense>
      {selected && (
        <Suspense fallback={null}>
          <BookingDetail
            booking={selected}
            canManage={false}
            banner={
              selected.kind === "manual" && selected.createdBy === ownerId && (selected.status === "requested" || selected.status === "scheduled") ? (
                <VaMeetingCancel booking={selected} onDone={() => setSelectedId(null)} />
              ) : undefined
            }
            onClose={() => setSelectedId(null)}
            onDone={() => undefined}
          />
        </Suspense>
      )}
      {block && blockId && (
        <Suspense fallback={null}>
          <RemoveBlockDialog blockId={blockId} block={block} onClose={() => setBlockId(null)} />
        </Suspense>
      )}
    </>
  );
}
