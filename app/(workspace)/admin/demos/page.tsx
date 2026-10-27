import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { ToastProvider } from "@/components/ui/toast";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { listCalendarDemos } from "@/features/demos/admin-dal";
import { VA_TIME_ZONE } from "@/features/demos/contract";
import { CalendarBoard } from "@/features/meetings/components/calendar-board";
import { listBookingChoices, listBookings } from "@/features/meetings/booking-dal";
import { requireRole } from "@/lib/auth/session";

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
  const [calendar, bookings, choices] = await Promise.all([
    listCalendarDemos(new Date(now)),
    listBookings(),
    listBookingChoices(user.id),
  ]);

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <ToastProvider>
      <CalendarBoard
        rows={calendar}
        bookings={bookings}
        clients={choices.clients}
        staff={choices.staff}
        creatorName={choices.creatorName}
        now={now}
        today={clock.slice(0, 10)}
        nowMinutes={minutesOf(clock)}
      />
      </ToastProvider>
    </Container>
  );
}
