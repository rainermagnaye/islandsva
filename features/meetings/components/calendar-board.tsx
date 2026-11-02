"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { wallClockIn, type IsoDate } from "@/components/ui/date-math";
import type { ScheduleEvent, ScheduleGesture } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { DemoCalendar } from "@/features/demos/components/demo-calendar";
import type { DemoCalendarRow } from "@/features/demos/calendar";
import { busyFrom } from "@/features/demos/slot-times";
import { editBooking, rescheduleDiscoveryAction } from "../actions";
import { draftOf, MANUAL_GESTURE } from "../booking-draft";
import { BOOKING_TIME_ZONE, type Booking, type BookingChoice } from "../contract";
import { MeetingsTable } from "./meetings-table";
import type { VaMeetingClient } from "./va-meeting-form";

const AdminBookingForm = lazy(() => import("./admin-booking-form").then((m) => ({ default: m.AdminBookingForm })));
const AdminBookingDetail = lazy(() => import("./admin-booking-detail").then((m) => ({ default: m.AdminBookingDetail })));
const AdminBookButton = lazy(() => import("./admin-book-button").then((m) => ({ default: m.AdminBookButton })));

type CreateDraft = { date: string; time?: string };

function timeFromMinute(minute: number) {
  const snapped = Math.floor(minute / 30) * 30;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${snapped % 60 ? "30" : "00"}`;
}

function asEvents(bookings: readonly Booking[]): ScheduleEvent[] {
  return bookings.map((booking) => ({
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: booking.status === "cancelled" ? "ocean" : booking.status === "requested" ? "sand" : "lagoon",
    pending: booking.status === "requested",
    done: booking.status === "done",
    who: invited(booking),
  }));
}

/** The admin calendar, the meetings on it, and the create and detail modals. */
export function CalendarBoard({
  rows,
  bookings,
  clients,
  staff,
  creatorName,
  openTasks,
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
  now: string;
  today: IsoDate;
  last: IsoDate;
  nowMinutes: number;
}) {
  const toast = useToast();
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const ids = new Set(bookings.map((booking) => booking.id));

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    setCreateDraft(null);
    setEditing(false);
    if (message === "Meeting cancelled.") setSelectedId(null);
  }

  function open(id: string) {
    setCreateDraft(null);
    setEditing(false);
    setSelectedId(id);
  }

  return (
    <div className="grid gap-7">
      <DemoCalendar
        rows={rows}
        now={now}
        today={today}
        nowMinutes={nowMinutes}
        extraEvents={asEvents(bookings)}
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
        eventGesture={(event) => gestureFor(bookings.find((booking) => booking.id === event.id))}
        onEventMove={(event, next) => {
          const booking = bookings.find((item) => item.id === event.id);
          if (!booking) return false;
          return placeBooking(booking, next, (message, tone) => toast.show({ title: message, tone }));
        }}
        onEventClick={(event) => {
          if (!ids.has(event.id)) return false;
          open(event.id);
          return true;
        }}
      />
      <MeetingsTable bookings={bookings} onOpen={open} />

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
    </div>
  );
}

function invited(booking: Booking) {
  const names = booking.guests.map((guest) => guest.name);
  if (names.length > 0) return names.join(", ");
  return booking.staffName ?? booking.clientName ?? undefined;
}

const DISCOVERY_GESTURE: ScheduleGesture = { move: true, resize: false, snap: 30, minLength: 30, maxLength: 30 };

/** A scheduled meeting can move and stretch. A discovery call only moves, and stays 30 minutes. */
function gestureFor(booking: Booking | undefined): ScheduleGesture | null {
  if (!booking || booking.status === "cancelled" || booking.status === "done") return null;
  if (booking.kind === "manual" && booking.status === "scheduled") return MANUAL_GESTURE;
  if (booking.kind === "discovery" && (booking.status === "requested" || booking.status === "scheduled")) return DISCOVERY_GESTURE;
  return null;
}

async function placeBooking(booking: Booking, next: { start: string; end: string }, tell: (message: string, tone: "success" | "danger") => void) {
  if (booking.kind === "discovery") {
    const form = new FormData();
    form.set("meetingId", booking.id);
    form.set("startDate", next.start.slice(0, 10));
    form.set("startTime", next.start.slice(11, 16));
    const result = await rescheduleDiscoveryAction(form);
    tell(result.ok ? "Meeting moved." : (result.fieldErrors?.startTime ?? result.message), result.ok ? "success" : "danger");
    return result.ok;
  }
  const form = new FormData();
  form.set("meetingId", booking.id);
  form.set("title", booking.title);
  form.set("startDate", next.start.slice(0, 10));
  form.set("startTime", next.start.slice(11, 16));
  form.set("endDate", next.end.slice(0, 10));
  form.set("endTime", next.end.slice(11, 16));
  for (const guest of booking.guests) form.append(guest.kind === "client" ? "clientIds" : "staffIds", guest.id);
  const result = await editBooking(form);
  tell(result.ok ? "Meeting updated." : (result.fieldErrors?.endTime ?? result.fieldErrors?.startTime ?? result.message), result.ok ? "success" : "danger");
  return result.ok;
}
