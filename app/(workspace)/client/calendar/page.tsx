import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { ClientCalendar } from "@/features/meetings/components/client-calendar";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listBookings } from "@/features/meetings/booking-dal";
import { listTasks } from "@/features/tasks/dal";
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
  await requireRole(["client"]);
  const now = new Date().toISOString();
  const clock = wallClockIn(now, BOOKING_TIME_ZONE);
  const [bookings, tasks] = await Promise.all([listBookings(), listTasks()]);

  return (
    <Container className="workspace-page grid gap-5 py-6 md:py-8">
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
        now={now}
        today={clock.slice(0, 10)}
        nowMinutes={minutesOf(clock)}
      />
    </Container>
  );
}
