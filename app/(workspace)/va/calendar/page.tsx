import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { minutesOf, wallClockIn } from "@/components/ui/date-math";
import { AddSlotsForm } from "@/features/demos/components/add-slots-form";
import { VaSlotList } from "@/features/demos/components/va-slot-list";
import { DEMO_LIMITS, manilaDate } from "@/features/demos/contract";
import { listVaSlots } from "@/features/demos/dal";
import { PersonCalendar } from "@/features/meetings/components/person-calendar";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listBookings } from "@/features/meetings/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar" };

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
  const slots = await listVaSlots(user.id);
  const bookings = await listBookings();
  const clock = wallClockIn(new Date().toISOString(), BOOKING_TIME_ZONE);
  const now = new Date();
  const last = new Date(now.getTime() + DEMO_LIMITS.publishDays * 24 * 3600 * 1000);

  return (
    <Workspace title="Calendar" lead="The times you can take a 30-minute demo call. Clients without a VA book them; you confirm or decline each request.">
      <section className="grid gap-3">
        <h2 className="m-0 type-h2">Meetings</h2>
        <PersonCalendar bookings={bookings} today={clock.slice(0, 10)} nowMinutes={minutesOf(clock)} />
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Add slots">
          <AddSlotsForm today={manilaDate(now)} last={manilaDate(last)} />
        </Panel>
        <Panel title="Your slots">
          <VaSlotList slots={slots} />
        </Panel>
      </div>
    </Workspace>
  );
}
