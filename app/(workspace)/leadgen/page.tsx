import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatDate, partOfDay, todayIn, wallClockIn } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { appRoutes, leadgenLeadHref } from "@/content/routes";
import { countClients } from "@/features/clients/dal";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { countLeads, listLeads } from "@/features/leads/dal";
import { agenda, closerAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listDiscoveryInbox } from "@/features/meetings/dal";
import { requireRole } from "@/lib/auth/session";
import { ThisWeekCard } from "@/features/meetings/components/this-week-card";

export const metadata: Metadata = { title: "Dashboard" };

const RECENT = 5;

function dayline(now: Date) {
  const clock = wallClockIn(now.toISOString(), BOOKING_TIME_ZONE);
  return {
    date: formatDate(clock.slice(0, 10), { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    greeting: `Good ${partOfDay(clock)}`,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function LeadgenHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenHome />
    </Suspense>
  );
}

async function LeadgenHome() {
  await requireRole(["closer"]);
  const now = new Date();
  const [leadCounts, clientCount, pendingClients, recentLeads, requests, bookings] = await Promise.all([
    countLeads(),
    countClients(),
    countClients("pending"),
    listLeads({ pageSize: RECENT }),
    listDiscoveryInbox(),
    listBookings(),
  ]);
  const { date, greeting } = dayline(now);
  const coming = agenda(closerAgendaSources({ bookings, requests }), BOOKING_TIME_ZONE, now, 7);

  return (
    <Workspace
      eyebrow={`${date} · Manila time`}
      title={greeting}
      lead={`${plural(leadCounts.new, "new lead", "new leads")} to work and ${plural(requests.length, "discovery call", "discovery calls")} to confirm.`}
    >
      {requests.length > 0 && (
        <Alert
          tone="info"
          title={requests.length === 1 ? "1 discovery call is waiting to confirm" : `${requests.length} discovery calls are waiting to confirm`}
          action={
            <Button href={appRoutes.leadgenCalendar} variant="secondary">
              Open calendar
            </Button>
          }
        >
          Confirm or decline so the lead hears back.
        </Alert>
      )}

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="New leads"
          value={leadCounts.new}
          icon="inbox"
          href={appRoutes.leadgenLeads}
          caption={leadCounts.total === 0 ? "Nothing in the pipeline yet" : `${leadCounts.total} in the pipeline`}
        />
        <StatCard
          label="Clients"
          value={clientCount}
          icon="briefcase"
          href={appRoutes.leadgenClients}
          caption={pendingClients > 0 ? `${pendingClients} still pending` : clientCount > 0 ? "On the books" : "None yet"}
        />
        <StatCard
          label="Calls waiting"
          value={requests.length}
          icon="calendar"
          href={appRoutes.leadgenCalendar}
          caption={coming.length > 0 ? `${coming.length} on the calendar this week` : "Discovery calls to confirm"}
        />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_35rem]">
          <Panel title="Latest leads" action={<ViewAll href={appRoutes.leadgenLeads}>All leads</ViewAll>}>
            <LeadsTable
              variant="summary"
              selectable={false}
              hrefFor={leadgenLeadHref}
              leads={recentLeads.leads}
              caption="Latest leads"
              empty={<EmptyState compact headingLevel={3} title="No leads yet" description="They appear here from the agency pipeline." />}
            />
          </Panel>
        </div>
        <aside aria-label="This week" className="grid min-w-0 flex-[1_1_18rem] gap-5 lg:max-w-[23.75rem]">
          <ThisWeekCard items={coming} today={todayIn(BOOKING_TIME_ZONE, now)} calendarHref={appRoutes.leadgenCalendar} />
        </aside>
      </div>
    </Workspace>
  );
}

function ViewAll({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="type-label">
      {children}
    </Link>
  );
}
