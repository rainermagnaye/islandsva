import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { listVaDemos } from "@/features/demos/booking-dal";
import { VaDemoList } from "@/features/demos/components/va-demo-list";
import { VaSlotList } from "@/features/demos/components/va-slot-list";
import { DEMO_LIMITS, manilaDate, VA_TIME_ZONE } from "@/features/demos/contract";
import { listVaSlots } from "@/features/demos/dal";
import { busyFrom } from "@/features/demos/slot-times";
import { listWorkingHours } from "@/features/matching/dal";
import { agenda, vaAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { listTeamForVa } from "@/features/meetings/service";
import { listTasks } from "@/features/tasks/dal";
import { listVaBlocks } from "@/features/tasks/service";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { TodaySchedule } from "../_components/today-schedule";
import { BookButton } from "./_components/book-button";
import { CALENDAR_LEGEND, calendarExtras, workingShifts } from "./_components/calendar-events";
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
  const comingUp = agenda(vaAgendaSources({ bookings, demos }), VA_TIME_ZONE, now, 7).slice(0, 6);
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
    <Workspace title="Calendar" actions={book}>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <VaCalendarView
          showToolbar
          ownerId={user.id}
          bookings={bookings}
          extras={extras}
          shifts={workingShifts(windows)}
          legend={CALENDAR_LEGEND}
          today={clock.slice(0, 10)}
          nowMinutes={minutesOf(clock)}
        />
        <aside aria-label="Demos and what's next" className="grid content-start gap-4">
          <Panel boxed title="Demo requests">
            <VaDemoList demos={requests} />
          </Panel>
          <TodaySchedule title="Coming up" showDay items={comingUp} empty="Nothing in the next 7 days." />
          <Panel boxed title="Your slots">
            <VaSlotList slots={slots} />
          </Panel>
        </aside>
      </div>
    </Workspace>
  );
}
