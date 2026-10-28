import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { ToastProvider } from "@/components/ui/toast";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { appRoutes, clientTaskHref } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { getOwnClientId } from "@/features/clients/dal";
import { listClientDemos } from "@/features/demos/booking-dal";
import { demoState } from "@/features/demos/contract";
import { agenda, clientAgendaSources } from "@/features/meetings/agenda";
import { ClientCalendar, type CalendarDemo } from "@/features/meetings/components/client-calendar";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listBookings } from "@/features/meetings/booking-dal";
import { scheduleRows } from "@/features/meetings/schedule";
import { listTasks } from "@/features/tasks/dal";
import { datedTasks, reviewQueue } from "@/features/tasks/team";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar" };

export default function ClientCalendarPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientCalendarPageBody />
    </Suspense>
  );
}

async function ClientCalendarPageBody() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only the meetings they're invited to, their own tasks, demos and assignments.
  const clientId = await getOwnClientId(user.id);
  const [bookings, tasks, bookingsOfDemos, assignments] = await Promise.all([
    listBookings(),
    listTasks(),
    clientId ? listClientDemos(clientId) : Promise.resolve([]),
    clientId ? listActiveAssignments(clientId) : Promise.resolve([]),
  ]);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const clock = wallClockIn(now, BOOKING_TIME_ZONE);

  const demos: CalendarDemo[] = bookingsOfDemos.flatMap((demo) => {
    const state = demoState(demo, nowDate);
    return state === "pending" || state === "confirmed" || state === "completed" ? [{ id: demo.id, vaName: demo.vaName, startsAt: demo.startsAt, endsAt: demo.endsAt, state }] : [];
  });

  const dated = datedTasks(tasks, nowDate).map(({ task, at, overdue }) => ({
    id: task.id,
    title: task.title,
    vaFirstName: task.vaFirstName,
    at,
    status: task.status,
    overdue,
    href: clientTaskHref(task.id),
  }));
  const linkedDemos = demos.map((demo) => ({ ...demo, href: appRoutes.clientMatch }));
  const waiting = reviewQueue(tasks);

  return (
    <Container className="workspace-page grid gap-8 py-6 md:py-8">
      <ToastProvider>
      <ClientCalendar
        bookings={bookings}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          vaFirstName: task.vaFirstName,
          deadline: task.deadline,
          deadlineTime: task.deadlineTime,
          deadlineTimezone: task.deadlineTimezone,
          status: task.status,
        }))}
        demos={demos}
        agenda={agenda(clientAgendaSources({ bookings, tasks: dated, demos: linkedDemos }), BOOKING_TIME_ZONE, nowDate)}
        schedule={scheduleRows({ bookings, tasks: dated, demos: linkedDemos })}
        review={waiting.length > 0 ? { count: waiting.length, href: clientTaskHref(waiting[0].id) } : null}
        team={assignments.map((assignment) => ({ id: assignment.vaId, label: assignment.vaName.trim().split(/\s+/)[0] || assignment.vaName }))}
        userId={user.id}
        now={now}
        today={clock.slice(0, 10)}
        nowMinutes={minutesOf(clock)}
      />
      </ToastProvider>
    </Container>
  );
}
