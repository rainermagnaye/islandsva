import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { PersonCalendar } from "@/features/meetings/components/person-calendar";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listBookings } from "@/features/meetings/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar" };

export default function ClientCalendarPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientCalendar />
    </Suspense>
  );
}

async function ClientCalendar() {
  await requireRole(["client"]);
  const bookings = await listBookings();
  const clock = wallClockIn(new Date().toISOString(), BOOKING_TIME_ZONE);

  return (
    <Workspace title="Calendar" lead="Meetings that include your company.">
      <PersonCalendar bookings={bookings} today={clock.slice(0, 10)} nowMinutes={minutesOf(clock)} />
    </Workspace>
  );
}
