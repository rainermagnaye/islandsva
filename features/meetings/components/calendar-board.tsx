"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { wallClockIn, type IsoDate } from "@/components/ui/date-math";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { DemoCalendar } from "@/features/demos/components/demo-calendar";
import type { DemoCalendarRow } from "@/features/demos/calendar";
import { busyFrom } from "@/features/demos/slot-times";
import { BLOCK_PREFIX } from "@/features/tasks/contract";
import { KIND_LEGEND } from "../calendar-legend";
import { draftOf, staffGesture } from "../booking-draft";
import { BOOKING_TIME_ZONE, type Booking, type BookingChoice } from "../contract";
import type { ScheduleRow } from "../schedule";
import { ScheduleTable } from "./schedule-table";
import { placeStaffBooking } from "./staff-moves";
import type { VaMeetingClient } from "./va-meeting-form";

const AdminBookingForm = lazy(() => import("./admin-booking-form").then((m) => ({ default: m.AdminBookingForm })));
const AdminBookingDetail = lazy(() => import("./admin-booking-detail").then((m) => ({ default: m.AdminBookingDetail })));
const AdminBookButton = lazy(() => import("./admin-book-button").then((m) => ({ default: m.AdminBookButton })));
const RemoveBlockDialog = lazy(() => import("@/features/tasks/components/remove-block-dialog").then((m) => ({ default: m.RemoveBlockDialog })));

type CreateDraft = { date: string; time?: string };

function timeFromMinute(minute: number) {
  const snapped = Math.floor(minute / 30) * 30;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${snapped % 60 ? "30" : "00"}`;
}

function asEvents(bookings: readonly Booking[], extras: readonly ScheduleEvent[]): ScheduleEvent[] {
  return [
    ...bookings
      .filter((booking) => booking.status !== "cancelled")
      .map((booking) => ({
        id: booking.id,
        title: booking.title,
        start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
        end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
        tone: booking.kind === "discovery" ? ("sand" as const) : ("lagoon" as const),
        pending: booking.status === "requested",
        done: booking.status === "done",
        who: invited(booking),
      })),
    ...extras,
  ];
}

/** The admin calendar, the meetings on it, and the create and detail modals. */
export function CalendarBoard({
  rows,
  bookings,
  clients,
  staff,
  creatorName,
  openTasks,
  extraEvents = [],
  schedule,
  now,
  today,
  last,
  nowMinutes,
}: {
  rows: readonly DemoCalendarRow[];
  bookings: readonly Booking[];
  clients: readonly VaMeetingClient[];
  staff: readonly BookingChoice[];
  creatorName: string;
  openTasks: readonly BookingChoice[];
  extraEvents?: readonly ScheduleEvent[];
  schedule: readonly ScheduleRow[];
  now: string;
  today: IsoDate;
  last: IsoDate;
  nowMinutes: number;
}) {
  const toast = useToast();
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const ids = new Set(bookings.map((booking) => booking.id));
  const shown = asEvents(bookings, extraEvents);
  const block = shown.find((event) => event.id === `${BLOCK_PREFIX}${blockId}`) ?? null;

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    setCreateDraft(null);
    setEditing(false);
    if (message === "Meeting cancelled.") setSelectedId(null);
  }

  function open(id: string) {
    setCreateDraft(null);
    setEditing(false);
    setBlockId(null);
    setSelectedId(id);
  }

  return (
    <div className="grid gap-7">
      <DemoCalendar
        rows={rows}
        now={now}
        today={today}
        nowMinutes={nowMinutes}
        extraEvents={shown}
        legend={KIND_LEGEND}
        viewsInHeader
        actions={
          <Suspense fallback={<Button type="button" variant="ghost" iconLeft="plus" disabled>Book</Button>}>
            <AdminBookButton
              today={today}
              last={last}
              slots={{ busy: busyFrom(bookings, []), offered: [], windows: [] }}
              clients={clients}
              team={staff}
              openTasks={openTasks}
              draft={createDraft}
              onDraftChange={(draft) => {
                setSelectedId(null);
                setEditing(false);
                setCreateDraft(draft);
              }}
            />
          </Suspense>
        }
        onSlotClick={(day, minute) => { setSelectedId(null); setEditing(false); setCreateDraft({ date: day, time: timeFromMinute(minute) }); }}
        eventGesture={(event) => staffGesture(bookings.find((booking) => booking.id === event.id))}
        onEventMove={(event, next) => {
          const booking = bookings.find((item) => item.id === event.id);
          if (!booking) return false;
          return placeStaffBooking(booking, next, (message, tone) => toast.show({ title: message, tone }));
        }}
        onEventClick={(event) => {
          if (event.id.startsWith(BLOCK_PREFIX)) {
            setSelectedId(null);
            setEditing(false);
            setCreateDraft(null);
            setBlockId(event.id.slice(BLOCK_PREFIX.length));
            return true;
          }
          if (!ids.has(event.id)) return false;
          setBlockId(null);
          open(event.id);
          return true;
        }}
      />
      <ScheduleTable rows={schedule} onOpenBooking={open} />

      {selected && !editing && (
        <Suspense fallback={null}>
          <AdminBookingDetail
            booking={selected}
            canManage
            onClose={() => setSelectedId(null)}
            onEdit={() => setEditing(true)}
            onDone={done}
          />
        </Suspense>
      )}
      {selected && editing && (
        <Suspense fallback={null}>
          <AdminBookingForm
            mode="edit"
            booking={selected}
            draft={draftOf(selected)}
            clients={clients}
            staff={staff}
            creatorName={creatorName}
            onClose={() => setEditing(false)}
            onDone={() => done("Meeting saved.")}
          />
        </Suspense>
      )}
      {block && blockId && (
        <Suspense fallback={null}>
          <RemoveBlockDialog blockId={blockId} block={block} onClose={() => setBlockId(null)} />
        </Suspense>
      )}
    </div>
  );
}

function invited(booking: Booking) {
  const names = booking.guests.map((guest) => guest.name);
  if (names.length > 0) return names.join(", ");
  return booking.staffName ?? booking.clientName ?? undefined;
}

