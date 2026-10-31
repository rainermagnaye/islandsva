import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { listVaDemos } from "@/features/demos/booking-dal";
import { VaDemoList } from "@/features/demos/components/va-demo-list";
import { DEMO_LIMITS, manilaDate, VA_TIME_ZONE } from "@/features/demos/contract";
import { listVaSlots } from "@/features/demos/dal";
import { busyFrom } from "@/features/demos/slot-times";
import { listWorkingHours } from "@/features/matching/dal";
import { agenda, vaAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { scheduleRows } from "@/features/meetings/schedule";
import { listTeamForVa } from "@/features/meetings/service";
import { listTasks } from "@/features/tasks/dal";
import { listVaBlocks } from "@/features/tasks/service";
import { datedTasks } from "@/features/tasks/team";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { BookButton } from "./_components/book-button";
import { calendarExtras } from "./_components/calendar-events";
import { VaCalendarView } from "./_components/va-calendar-view";

export const metadata: Metadata = { title: "Calendar" };

const DAY_MS = 24 * 3600 * 1000;

export default function VaCalendarPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaCalendar />
    </Suspense>
  );
}

async function VaCalendar() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);

  const now = new Date();
  // Blocks from the start of this Manila day, so today's earlier ones still show.
  const dayStart = new Date(`${manilaDate(now)}T00:00:00+08:00`);
  const [slots, bookings, demos, tasks, windows, clients, team, blocks] = await Promise.all([
    listVaSlots(user.id),
    listBookings(),
    listVaDemos(user.id),
    listTasks(),
    listWorkingHours(user.id),
    listAssignedClients(user.id),
    listTeamForVa(user.id),
    listVaBlocks(user.id, dayStart),
  ]);

  const clock = wallClockIn(now.toISOString(), VA_TIME_ZONE);
  const ownTasks = tasks.filter((task) => task.vaId === user.id);
  const extras = calendarExtras({ demos, slots, tasks: ownTasks, blocks }, VA_TIME_ZONE, vaTaskHref);
  const dated = datedTasks(ownTasks, now).map(({ task, at, overdue }) => ({
    id: task.id,
    title: task.title,
    vaFirstName: task.companyName,
    at,
    status: task.status,
    overdue,
    href: vaTaskHref(task.id),
  }));
  const calls = demos.flatMap((demo) =>
    demo.status === "pending" || demo.status === "confirmed"
      ? [{ id: demo.id, vaName: demo.companyName, startsAt: demo.startsAt, endsAt: demo.endsAt, state: demo.status, href: `${appRoutes.vaCalendar}#demo-requests` }]
      : [],
  );
  const comingUp = agenda(
    [
      ...vaAgendaSources({ bookings, demos }),
      ...dated.map((task) => ({
        key: `task:${task.id}`,
        kind: "deadline" as const,
        title: task.title,
        at: task.at,
        end: null,
        who: task.vaFirstName,
        overdue: task.overdue,
        badge: task.overdue ? { label: "Overdue" as const, tone: "danger" as const } : null,
        href: task.href,
        bookingId: null,
      })),
    ],
    VA_TIME_ZONE,
    now,
  );
  const requests = demos.filter((demo) => demo.status === "pending");
  const openTasks = ownTasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((task) => ({ id: task.id, label: `${task.title} · ${task.companyName}` }));
  const book = (
    <BookButton
      today={manilaDate(now)}
      last={manilaDate(new Date(now.getTime() + DEMO_LIMITS.publishDays * DAY_MS))}
      slots={{ busy: busyFrom(bookings, demos), offered: slots.map((slot) => slot.startsAt), windows }}
      clients={clients.map((client) => ({ id: client.id, label: client.companyName, timezone: client.timezone }))}
      team={team}
      openTasks={openTasks}
    />
  );

  return (
    <Container className="workspace-page grid gap-8 py-6 md:py-8">
      <VaCalendarView
        ownerId={user.id}
        bookings={bookings}
        extras={extras}
        agenda={comingUp}
        schedule={scheduleRows({ bookings, tasks: dated, demos: calls })}
        today={clock.slice(0, 10)}
        now={now.toISOString()}
        nowMinutes={minutesOf(clock)}
        actions={book}
        tools={
          <Panel boxed title="Demo requests">
            <div id="demo-requests">
              <VaDemoList demos={requests} />
            </div>
          </Panel>
        }
      />
    </Container>
  );
}
