"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { useToast } from "@/components/ui/toast";
import { leadgenClientHref, leadgenLeadHref } from "@/content/routes";
import type { BusyTime } from "@/features/demos/slot-times";
import type { AgendaItem } from "@/features/meetings/agenda";
import { CLOSER_LEGEND } from "@/features/meetings/calendar-legend";
import { staffGesture } from "@/features/meetings/booking-draft";
import { ComingUp } from "@/features/meetings/components/coming-up";
import { DiscoveryInbox } from "@/features/meetings/components/discovery-inbox";
import type { Booking, BookingChoice, DiscoveryRequest } from "@/features/meetings/contract";
import { BLOCK_PREFIX } from "@/features/tasks/contract";
import type { VaMeetingClient } from "@/features/meetings/components/va-meeting-form";
import type { ScheduleRow } from "@/features/meetings/schedule";

type CloserBookDraft = { date: string; time?: string };

const DemoCalendar = lazy(() => import("@/features/demos/components/demo-calendar").then((module) => ({ default: module.DemoCalendar })));
const ScheduleTable = lazy(() => import("@/features/meetings/components/schedule-table").then((module) => ({ default: module.ScheduleTable })));
const BookButton = lazy(() => import("./book-button").then((module) => ({ default: module.BookButton })));
const BookingDetail = lazy(() => import("@/features/meetings/components/booking-detail").then((module) => ({ default: module.BookingDetail })));
const DiscoveryDetail = lazy(() => import("@/features/meetings/components/discovery-detail").then((module) => ({ default: module.DiscoveryDetail })));
const CloserMeetingCancel = lazy(() => import("@/features/meetings/components/closer-meeting-cancel").then((module) => ({ default: module.CloserMeetingCancel })));
const RemoveBlockDialog = lazy(() => import("@/features/tasks/components/remove-block-dialog").then((module) => ({ default: module.RemoveBlockDialog })));

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
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CloserBookDraft | null>(null);
  const request = requests.find((item) => item.meetingId === selectedId) ?? null;
  const booking = bookings.find((item) => item.id === selectedId) ?? null;
  const discovery = request || booking?.kind === "discovery";
  const block = events.find((event) => event.id === `${BLOCK_PREFIX}${blockId}`) ?? null;

  function open(id: string) {
    if (requests.some((item) => item.meetingId === id) || bookings.some((item) => item.id === id)) {
      setDraft(null);
      setBlockId(null);
      setSelectedId(id);
    }
  }

  function close() {
    setSelectedId(null);
    setBlockId(null);
  }

  function done(message: string) {
    toast.show({ title: message, tone: "success" });
    close();
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
          legend={CLOSER_LEGEND}
          viewsInHeader
          actions={
            <Suspense fallback={<Button type="button" variant="ghost" iconLeft="plus" disabled>Book</Button>}>
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
            </Suspense>
          }
          aside={
            <>
              <div className="shrink-0">
                <Panel boxed title="Discovery requests">
                  {requests.length > 0 ? (
                    <DiscoveryInbox requests={requests} onOpen={open} />
                  ) : (
                    <EmptyState compact title="No discovery requests" description="When a lead books a discovery call, it shows here for you to confirm." />
                  )}
                </Panel>
              </div>
              <ComingUp className="min-h-0 flex-1" items={agenda} review={null} onOpenBooking={open} />
            </>
          }
          onSlotClick={(day, minute) => {
            setSelectedId(null);
            setBlockId(null);
            setDraft({ date: day, time: timeFromMinute(minute) });
          }}
          eventGesture={(event) => {
            const booking = bookings.find((item) => item.id === event.id);
            if (booking) return staffGesture(booking);
            if (requests.some((item) => item.meetingId === event.id)) return staffGesture({ kind: "discovery", status: "requested" });
            return null;
          }}
          onEventMove={async (event, next) => {
            const tell = (message: string, tone: "success" | "danger") => toast.show({ title: message, tone });
            const { placeStaffBooking } = await import("@/features/meetings/components/staff-moves");
            const booking = bookings.find((item) => item.id === event.id);
            if (booking) return placeStaffBooking(booking, next, tell);
            const request = requests.find((item) => item.meetingId === event.id);
            if (!request) return false;
            return placeStaffBooking({ id: request.meetingId, kind: "discovery" }, next, tell);
          }}
          onEventClick={(event) => {
            if (event.id.startsWith(BLOCK_PREFIX)) {
              setSelectedId(null);
              setDraft(null);
              setBlockId(event.id.slice(BLOCK_PREFIX.length));
              return true;
            }
            open(event.id);
            return true;
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ScheduleTable rows={schedule} onOpenBooking={open} />
      </Suspense>
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
      {block && blockId && (
        <Suspense fallback={null}>
          <RemoveBlockDialog blockId={blockId} block={block} onClose={() => setBlockId(null)} />
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
