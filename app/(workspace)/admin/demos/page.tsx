import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { ToastProvider } from "@/components/ui/toast";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { adminClientHref } from "@/content/routes";
import { listCalendarDemos } from "@/features/demos/admin-dal";
import { DEMO_LIMITS, manilaDate, VA_TIME_ZONE } from "@/features/demos/contract";
import { CalendarBoard } from "@/features/meetings/components/calendar-board";
import { listBookingChoices, listBookings } from "@/features/meetings/booking-dal";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { scheduleRows } from "@/features/meetings/schedule";
import { BLOCK_PREFIX } from "@/features/tasks/contract";
import { deadlineEvent } from "@/features/tasks/deadline-event";
import { listTasks } from "@/features/tasks/dal";
import { listVaBlocks } from "@/features/tasks/service";
import { datedTasks } from "@/features/tasks/team";
import { requireRole } from "@/lib/auth/session";

const DAY_MS = 24 * 3600 * 1000;

export const metadata: Metadata = { title: "Calendar" };

export default function AdminDemosPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminDemos />
    </Suspense>
  );
}

async function AdminDemos() {
  const user = await requireRole(["admin"]);
  const now = new Date().toISOString();
  const clock = wallClockIn(now, VA_TIME_ZONE);
  const dayStart = new Date(`${clock.slice(0, 10)}T00:00:00+08:00`);
  const [calendar, bookings, choices, tasks, blocks] = await Promise.all([
    listCalendarDemos(new Date(now)),
    listBookings(),
    listBookingChoices(user.id),
    listTasks(),
    listVaBlocks(user.id, dayStart),
  ]);
  const open = tasks.filter((task) => task.status !== "done");
  const openTasks = open.map((task) => ({ id: task.id, label: `${task.title} · ${task.companyName}` }));
  const dated = datedTasks(open, new Date(now));
  const liveDemos = calendar.filter((row) => row.status === "pending" || row.status === "confirmed" || row.status === "completed");
  const extraEvents = [
    ...dated.map(({ task }) =>
      deadlineEvent(
        {
          id: task.id,
          title: task.title,
          vaFirstName: task.vaFirstName,
          deadline: task.deadline,
          deadlineTime: task.deadlineTime,
          deadlineTimezone: task.deadlineTimezone,
          status: task.status,
        },
        BOOKING_TIME_ZONE,
      ),
    ),
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
    <Container className="grid gap-7 py-10 md:py-12">
      <ToastProvider>
      <CalendarBoard
        rows={liveDemos}
        bookings={bookings}
        clients={choices.clients}
        staff={choices.staff}
        creatorName={choices.creatorName}
        openTasks={openTasks}
        extraEvents={extraEvents}
        schedule={scheduleRows({
          bookings,
          tasks: dated.map(({ task, at, overdue }) => ({
            id: task.id,
            title: task.title,
            vaFirstName: task.vaFirstName,
            at,
            status: task.status,
            overdue,
            href: adminClientHref(task.clientId),
          })),
          demos: liveDemos.map((demo) => ({
            id: demo.id,
            vaName: demo.vaName,
            startsAt: demo.startsAt,
            endsAt: demo.endsAt,
            state: demo.status === "pending" ? "pending" : demo.status === "completed" ? "completed" : "confirmed",
            href: adminClientHref(demo.clientId),
          })),
        })}
        now={now}
        today={clock.slice(0, 10)}
        last={manilaDate(new Date(new Date(now).getTime() + DEMO_LIMITS.publishDays * DAY_MS))}
        nowMinutes={minutesOf(clock)}
      />
      </ToastProvider>
    </Container>
  );
}
