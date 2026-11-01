"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { leadgenClientHref, leadgenLeadHref } from "@/content/routes";
import { DemoCalendar, type CalendarLegendItem } from "@/features/demos/components/demo-calendar";
import type { BusyTime } from "@/features/demos/slot-times";
import type { AgendaItem } from "@/features/meetings/agenda";
import { ComingUp } from "@/features/meetings/components/coming-up";
import { ScheduleTable } from "@/features/meetings/components/schedule-table";
import type { Booking, BookingChoice, DiscoveryRequest } from "@/features/meetings/contract";
import type { VaMeetingClient } from "@/features/meetings/components/va-meeting-form";
import type { ScheduleRow } from "@/features/meetings/schedule";
import { BookButton, type CloserBookDraft } from "./book-button";

const BookingDetail = lazy(() => import("@/features/meetings/components/booking-detail").then((module) => ({ default: module.BookingDetail })));
const DiscoveryDetail = lazy(() => import("@/features/meetings/components/discovery-detail").then((module) => ({ default: module.DiscoveryDetail })));
const CloserMeetingCancel = lazy(() => import("@/features/meetings/components/closer-meeting-cancel").then((module) => ({ default: module.CloserMeetingCancel })));

const LEGEND: readonly CalendarLegendItem[] = [
  { tone: "lagoon", label: "Meetings" },
  { tone: "sand", label: "Discovery requests" },
];

function timeFromMinute(minute: number) {
  const snapped = Math.floor(minute / 30) * 30;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${snapped % 60 ? "30" : "00"}`;
}

/** The closer's calendar in the VA frame: Book, day/week/month, inbox beside it, and a request or call in a modal. */
export function CloserCalendarView({
  ownerId,
  bookings,
  requests,
  events,
  agenda,
  schedule,
  today,
  last,
  now,
  nowMinutes,
  clients,
  team,
  openTasks,
  slots,
  tools,
}: {
  ownerId: string;
  bookings: readonly Booking[];
  requests: readonly DiscoveryRequest[];
  events: readonly ScheduleEvent[];
  agenda: readonly AgendaItem[];
  schedule: readonly ScheduleRow[];
  today: string;
  last: string;
  now: string;
  nowMinutes: number;
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
  slots: { busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] };
  tools: ReactNode;
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CloserBookDraft | null>(null);
  const request = requests.find((item) => item.meetingId === selectedId) ?? null;
  const booking = bookings.find((item) => item.id === selectedId) ?? null;
  const discovery = request || booking?.kind === "discovery";

  function open(id: string) {
    if (requests.some((item) => item.meetingId === id) || bookings.some((item) => item.id === id)) {
      setDraft(null);
      setSelectedId(id);
    }
  }

  function close() {
    setSelectedId(null);
  }

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    close();
  }

  return (
    <>
      <DemoCalendar
        rows={[]}
        now={now}
        today={today}
        nowMinutes={nowMinutes}
        extraEvents={events}
        legend={LEGEND}
        viewsInHeader
        actions={
          <BookButton
            today={today}
            last={last}
            slots={slots}
            clients={clients}
            team={team}
            openTasks={openTasks}
            draft={draft}
            onDraftChange={setDraft}
          />
        }
        aside={
          <>
            {tools && <div className="shrink-0">{tools}</div>}
            <ComingUp className="min-h-0 flex-1" items={agenda} review={null} onOpenBooking={open} />
          </>
        }
        onSlotClick={(day, minute) => {
          setSelectedId(null);
          setDraft({ date: day, time: timeFromMinute(minute) });
        }}
        onEventClick={(event) => {
          open(event.id);
          return true;
        }}
      />
      <ScheduleTable rows={schedule} onOpenBooking={open} />
      {selectedId && discovery && (
        <Suspense fallback={null}>
          <DiscoveryDetail
            request={request}
            booking={request ? null : booking}
            personHref={booking?.leadId ? leadgenLeadHref(booking.leadId) : null}
            personLabel={booking?.leadId ? "Open lead" : null}
            onClose={close}
            onDone={done}
          />
        </Suspense>
      )}
      {selectedId && booking && !discovery && (
        <Suspense fallback={null}>
          <BookingDetail
            booking={booking}
            canManage={false}
            description={ownMeetingCopy(booking, ownerId)}
            footer={meetingFooter(booking, ownerId, done)}
            onClose={close}
            onDone={() => undefined}
          />
        </Suspense>
      )}
    </>
  );
}

function ownMeetingCopy(booking: Booking, ownerId: string) {
  if (booking.kind !== "manual" || booking.createdBy !== ownerId) return undefined;
  if (booking.status === "requested") return `Waiting for ${booking.clientName ?? "the client"} to accept.`;
  if (booking.status === "scheduled") return "You booked this meeting.";
  return undefined;
}

function meetingFooter(booking: Booking, ownerId: string, onDone: (message: string) => void) {
  const own = booking.kind === "manual" && booking.createdBy === ownerId && (booking.status === "requested" || booking.status === "scheduled");
  if (!booking.clientId && !own) return undefined;
  return (
    <>
      {booking.clientId ? <Button href={leadgenClientHref(booking.clientId)} variant="secondary">Open client</Button> : null}
      {own ? <CloserMeetingCancel booking={booking} onDone={onDone} /> : null}
    </>
  );
}
