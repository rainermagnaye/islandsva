"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addDays, wallClockIn, type IsoDate } from "@/components/ui/date-math";
import type { ScheduleEvent, ScheduleGesture } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { DemoCalendar } from "@/features/demos/components/demo-calendar";
import type { DemoCalendarRow } from "@/features/demos/calendar";
import { editBooking, rescheduleDiscoveryAction } from "../actions";
import { BOOKING_TIME_ZONE, type Booking, type BookingChoice } from "../contract";
import { BookingDetail } from "./booking-detail";
import { BookingForm, type BookingDraft } from "./booking-form";
import { MeetingsTable } from "./meetings-table";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function draftFrom(day: IsoDate, minute: number): BookingDraft {
  const endTotal = minute + 60;
  const endMinute = endTotal % (24 * 60);
  return {
    startDate: day,
    startTime: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`,
    endDate: endTotal >= 24 * 60 ? addDays(day, 1) : day,
    endTime: `${pad(Math.floor(endMinute / 60))}:${pad(endMinute % 60)}`,
  };
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
  now,
  today,
  nowMinutes,
}: {
  rows: readonly DemoCalendarRow[];
  bookings: readonly Booking[];
  clients: readonly BookingChoice[];
  staff: readonly BookingChoice[];
  creatorName: string;
  now: string;
  today: IsoDate;
  nowMinutes: number;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const ids = new Set(bookings.map((booking) => booking.id));

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    setDraft(null);
    setEditing(false);
    if (message === "Meeting cancelled.") setSelectedId(null);
  }

  function open(id: string) {
    setDraft(null);
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
        toolbar={<Button type="button" size="sm" iconLeft="plus" onClick={() => { setSelectedId(null); setEditing(false); setDraft(draftFrom(today, 9 * 60)); }}>New meeting</Button>}
        onSlotClick={(day, minute) => { setSelectedId(null); setEditing(false); setDraft(draftFrom(day, minute)); }}
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

      {draft && (
        <BookingForm
          mode="create"
          draft={draft}
          clients={clients}
          staff={staff}
          creatorName={creatorName}
          onClose={() => setDraft(null)}
          onDone={() => done("Meeting added.")}
        />
      )}
      {selected && !editing && (
        <BookingDetail
          booking={selected}
          canManage
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(true)}
          onDone={done}
        />
      )}
      {selected && editing && (
        <BookingForm
          mode="edit"
          booking={selected}
          draft={draftOf(selected)}
          clients={clients}
          staff={staff}
          creatorName={creatorName}
          onClose={() => setEditing(false)}
          onDone={() => done("Meeting saved.")}
        />
      )}
    </div>
  );
}

function invited(booking: Booking) {
  const names = booking.guests.map((guest) => guest.name);
  if (names.length > 0) return names.join(", ");
  return booking.staffName ?? booking.clientName ?? undefined;
}

const MANUAL_GESTURE: ScheduleGesture = { move: true, resize: true, snap: 15, minLength: 15, maxLength: 8 * 60 };
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

function draftOf(booking: Booking): BookingDraft {
  const start = wallClockIn(booking.startsAt, BOOKING_TIME_ZONE);
  const end = wallClockIn(booking.endsAt, BOOKING_TIME_ZONE);
  return { startDate: start.slice(0, 10), startTime: start.slice(11, 16), endDate: end.slice(0, 10), endTime: end.slice(11, 16) };
}
