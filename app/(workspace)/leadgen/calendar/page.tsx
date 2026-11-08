import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { minutesOf, todayIn, wallClockIn } from "@/components/ui/date-math";
import type { ScheduleEvent } from "@/components/ui/schedule-events";
import { ToastProvider } from "@/components/ui/toast";
import { listClients } from "@/features/clients/dal";
import { DEMO_LIMITS, manilaDate } from "@/features/demos/contract";
import { busyFrom } from "@/features/demos/slot-times";
import { agenda, closerAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { BOOKING_TIME_ZONE, type Booking } from "@/features/meetings/contract";
import { listDiscoveryInbox } from "@/features/meetings/dal";
import { scheduleRows, type ScheduleRow } from "@/features/meetings/schedule";
import { listTeamForCloser } from "@/features/meetings/service";
import { BLOCK_PREFIX } from "@/features/tasks/contract";
import { listVaBlocks } from "@/features/tasks/service";
import { requireRole } from "@/lib/auth/session";
import { CloserCalendarView } from "./_components/closer-calendar-view";

export const metadata: Metadata = { title: "Calendar" };

const DAY_MS = 24 * 3600 * 1000;

export default function LeadgenCalendarPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenCalendar />
    </Suspense>
  );
}

async function LeadgenCalendar() {
  const user = await requireRole(["closer"]);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const dayStart = new Date(`${todayIn(BOOKING_TIME_ZONE, nowDate)}T00:00:00+08:00`);
  const [requests, bookings, clientsPage, team, blocks] = await Promise.all([
    listDiscoveryInbox(),
    listBookings(),
    listClients({ pageSize: 100 }),
    listTeamForCloser(user.id),
    listVaBlocks(user.id, dayStart),
  ]);
  const waiting = new Set(requests.map((request) => request.meetingId));
  const visible = bookings.filter((booking) => booking.status !== "cancelled" && !waiting.has(booking.id));
  const sources = closerAgendaSources({ bookings: visible, requests });

  const requestRows: ScheduleRow[] = requests.map((request) => ({
    key: request.meetingId,
    kind: "meeting",
    title: request.companyName || request.fullName,
    at: request.startsAt,
    end: request.endsAt,
    who: request.fullName,
    status: { label: "Requested", tone: "warning" },
    href: null,
    bookingId: request.meetingId,
  }));

  const events: ScheduleEvent[] = [
    ...requests.map((request) => ({
      id: request.meetingId,
      title: request.companyName || request.fullName,
      start: wallClockIn(request.startsAt, BOOKING_TIME_ZONE),
      end: wallClockIn(request.endsAt, BOOKING_TIME_ZONE),
      tone: "sand" as const,
      pending: true,
      who: request.fullName,
    })),
    ...visible.map(bookingEvent),
    ...blocks.map((block) => ({
      id: `${BLOCK_PREFIX}${block.id}`,
      title: block.title,
      start: wallClockIn(block.startsAt, BOOKING_TIME_ZONE),
      end: wallClockIn(block.endsAt, BOOKING_TIME_ZONE),
      tone: "coral" as const,
      who: "To-do",
    })),
  ];

  return (
    <Container className="workspace-page grid gap-8 py-6 md:py-8">
      <ToastProvider>
        <CloserCalendarView
          ownerId={user.id}
          bookings={visible}
          requests={requests}
          events={events}
          agenda={agenda(sources, BOOKING_TIME_ZONE, nowDate)}
          schedule={[...requestRows, ...scheduleRows({ bookings: visible, tasks: [], demos: [] })]}
          today={todayIn(BOOKING_TIME_ZONE, nowDate)}
          last={manilaDate(new Date(nowDate.getTime() + DEMO_LIMITS.publishDays * DAY_MS))}
          now={now}
          nowMinutes={minutesOf(wallClockIn(now, BOOKING_TIME_ZONE))}
          clients={clientsPage.clients.map((client) => ({
            id: client.id,
            label: client.companyName,
            timezone: null,
            active: client.status === "active",
          }))}
          team={team}
          openTasks={[]}
          slots={{
            busy: busyFrom(
              [
                ...visible,
                ...requests.map((request) => ({
                  title: request.companyName || request.fullName,
                  status: "requested",
                  startsAt: request.startsAt,
                  endsAt: request.endsAt,
                  clientName: request.fullName,
                })),
              ],
              [],
            ),
            offered: [],
            windows: [],
          }}
        />
      </ToastProvider>
    </Container>
  );
}

function bookingEvent(booking: Booking): ScheduleEvent {
  return {
    id: booking.id,
    title: booking.title,
    start: wallClockIn(booking.startsAt, BOOKING_TIME_ZONE),
    end: wallClockIn(booking.endsAt, BOOKING_TIME_ZONE),
    tone: booking.kind === "discovery" ? "sand" : "lagoon",
    pending: booking.status === "requested",
    done: booking.status === "done",
    who: booking.clientName ?? undefined,
  };
}
