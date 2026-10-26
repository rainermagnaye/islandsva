import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { todayIn, wallClockIn } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes } from "@/content/routes";
import { getActiveAssignment } from "@/features/clients/assignment-dal";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { getLatestDemo, listOpenSlots } from "@/features/demos/booking-dal";
import { BookDemoForm, type BookableSlot } from "@/features/demos/components/book-demo-form";
import { bookableTimes, demoState, isOpenDemo, safeTimeZone } from "@/features/demos/contract";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Book a demo call" };

export default function ClientDemoPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientDemo />
    </Suspense>
  );
}

async function ClientDemo() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record, its assignment, its bookings and the slots they may book.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) redirect(appRoutes.client);
  const [assignment, latest] = await Promise.all([getActiveAssignment(client.id), getLatestDemo(client.id)]);
  if (assignment || (latest && isOpenDemo(demoState(latest)))) redirect(appRoutes.client);

  const zone = safeTimeZone(client.timezone);
  // Each time as the wall clock in the client's zone, which the calendar and the time picker show.
  const slots: BookableSlot[] = bookableTimes(await listOpenSlots()).map((slot) => ({ slotId: slot.slotId, start: wallClockIn(slot.startsAt, zone) }));

  return (
    <Workspace
      title="Book a demo call"
      lead="A 30-minute call with one of our VAs, so you can talk through your work before you're matched."
      breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", href: appRoutes.client }, { label: "Book a demo call" }]} />}
    >
      <Panel title="Available times">
        {slots.length > 0 ? (
          <BookDemoForm slots={slots} timeZone={zone} today={todayIn(zone)} />
        ) : (
          <EmptyState
            compact
            title="No times open right now"
            description="Our VAs add new times every week. Please check back soon, or reply to any email from your Islands VA contact."
            action={
              <Button href={appRoutes.client} variant="secondary" size="sm">
                Back to dashboard
              </Button>
            }
          />
        )}
      </Panel>
    </Workspace>
  );
}
