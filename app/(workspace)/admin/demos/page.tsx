import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { ToastProvider } from "@/components/ui/toast";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { listCalendarDemos } from "@/features/demos/admin-dal";
import { DEMO_LIMITS, manilaDate, VA_TIME_ZONE } from "@/features/demos/contract";
import { CalendarBoard } from "@/features/meetings/components/calendar-board";
import { listBookingChoices, listBookings } from "@/features/meetings/booking-dal";
import { listTasks } from "@/features/tasks/dal";
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
  const [calendar, bookings, choices, tasks] = await Promise.all([
    listCalendarDemos(new Date(now)),
    listBookings(),
    listBookingChoices(user.id),
    listTasks(),
  ]);
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({ id: task.id, label: `${task.title} · ${task.companyName}` }));

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <ToastProvider>
      <CalendarBoard
        rows={calendar}
        bookings={bookings}
        clients={choices.clients}
        staff={choices.staff}
        creatorName={choices.creatorName}
        openTasks={openTasks}
        now={now}
        today={clock.slice(0, 10)}
        last={manilaDate(new Date(new Date(now).getTime() + DEMO_LIMITS.publishDays * DAY_MS))}
        nowMinutes={minutesOf(clock)}
      />
      </ToastProvider>
    </Container>
  );
}
