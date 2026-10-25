import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes } from "@/content/routes";
import { getActiveAssignment } from "@/features/clients/assignment-dal";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { getLatestDemo, listOpenSlots } from "@/features/demos/booking-dal";
import { BookDemoForm, type TimeGroup } from "@/features/demos/components/book-demo-form";
import { bookableTimes, demoState, isOpenDemo } from "@/features/demos/contract";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Book a demo call" };

export default function ClientDemoPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientDemo />
    </Suspense>
  );
}

/** A zone the browser and Node know, or UTC (a stored zone is validated at entry, but fail safe). */
function safeZone(zone: string | null) {
  try {
    if (zone) return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    // An unknown zone falls through to UTC.
  }
  return "UTC";
}

async function ClientDemo() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record, its assignment, its bookings and the slots they may book.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) redirect(appRoutes.client);
  const [assignment, latest] = await Promise.all([getActiveAssignment(client.id), getLatestDemo(client.id)]);
  if (assignment || (latest && isOpenDemo(demoState(latest)))) redirect(appRoutes.client);

  const zone = safeZone(client.timezone);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: zone });
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone });
  const groups: TimeGroup[] = [];
  for (const slot of bookableTimes(await listOpenSlots())) {
    const label = day.format(new Date(slot.startsAt));
    const group = groups.at(-1)?.day === label ? groups.at(-1) : undefined;
    const entry = { slotId: slot.slotId, label: time.format(new Date(slot.startsAt)) };
    if (group) group.times.push(entry);
    else groups.push({ day: label, times: [entry] });
  }

  return (
    <Workspace
      title="Book a demo call"
      lead="A 30-minute call with one of our VAs, so you can talk through your work before you're matched."
      breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", href: appRoutes.client }, { label: "Book a demo call" }]} />}
    >
      <Panel title="Available times">
        {groups.length > 0 ? (
          <BookDemoForm groups={groups} zoneLabel={`${zone.replace(/_/g, " ")} time`} />
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
