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
import { packages } from "@/content/packages";
import { appRoutes } from "@/content/routes";
import { listActiveAssignmentLoads } from "@/features/clients/assignment-dal";
import { countClients, listActivePackageRows } from "@/features/clients/dal";
import { vaLoad } from "@/features/clients/load";
import { packageMix } from "@/features/clients/mix";
import { countOpenRequests } from "@/features/demos/admin-dal";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { countLeads, listLeads } from "@/features/leads/dal";
import { agenda, closerAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { ThisWeekCard } from "@/features/meetings/components/this-week-card";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { listDiscoveryTimes } from "@/features/meetings/dal";
import { recurringRevenue } from "@/features/sales/dal";
import { listTaskMetrics } from "@/features/tasks/dal";
import { performance, performanceByVa } from "@/features/tasks/metrics";
import { vaPortalOpen } from "@/features/users/contract";
import { listUsers, listVaRoster } from "@/features/users/dal";
import { UsersTable } from "@/features/users/components/users-table";
import { requireRole } from "@/lib/auth/session";
import { PackageMix, RevenueCard, VaLoad } from "./_components/overview-tables";

export const metadata: Metadata = { title: "Dashboard" };

const RECENT = 5;
const packageNames = Object.fromEntries(packages.map((item) => [item.slug, item.name]));

function dayline(now: Date) {
  const clock = wallClockIn(now.toISOString(), BOOKING_TIME_ZONE);
  return {
    date: formatDate(clock.slice(0, 10), { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    greeting: `Good ${partOfDay(clock)}`,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function AdminHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await requireRole(["admin"]);
  const now = new Date();
  // Independent reads, fetched in parallel. Each runs as the signed-in admin, so RLS applies too.
  const [leadCounts, clientCount, pendingClients, openRequests, recentLeads, recentUsers, recurring, packageRows, assignments, roster, taskMetrics, discovery, bookings] = await Promise.all([
    countLeads(),
    countClients(),
    countClients("pending"),
    countOpenRequests(),
    listLeads({ pageSize: RECENT }),
    listUsers(RECENT),
    recurringRevenue(),
    listActivePackageRows(),
    listActiveAssignmentLoads(),
    listVaRoster(),
    listTaskMetrics(),
    listDiscoveryTimes(),
    listBookings(),
  ]);
  const openVas = roster
    .filter((va) => va.roles.includes("va") && vaPortalOpen(va.status, va.reviewStatus))
    .map((va) => ({ id: va.id, firstName: va.fullName }));
  const overdue = performance(taskMetrics, now).overdue;
  // discovery_inbox is closer-only; an admin already sees requested discovery in listBookings.
  const coming = agenda(closerAgendaSources({ bookings, requests: [] }), BOOKING_TIME_ZONE, now, 7);
  const { date, greeting } = dayline(now);

  return (
    <Workspace
      eyebrow={`${date} · Manila time`}
      title={greeting}
      lead={`${plural(leadCounts.new, "new lead", "new leads")} to work and ${plural(openRequests, "demo request", "demo requests")} waiting for a VA.`}
    >
      {discovery.times.length === 0 && (
        <Alert
          tone="warning"
          title="Visitors can't request a discovery call yet"
          action={
            <Button href={appRoutes.adminSettings} variant="secondary">
              Set discovery times
            </Button>
          }
        >
          Add the daily times so the contact form can offer a slot.
        </Alert>
      )}
      {openRequests > 0 && (
        <Alert
          tone="info"
          title={openRequests === 1 ? "1 demo request is waiting for a VA" : `${openRequests} demo requests are waiting for a VA`}
          action={
            <Button href={appRoutes.adminDemos} variant="secondary">
              Open calendar
            </Button>
          }
        >
          A VA still needs to confirm.
        </Alert>
      )}

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New leads"
          value={leadCounts.new}
          icon="inbox"
          href={appRoutes.adminLeads}
          caption={leadCounts.total === 0 ? "Nothing in the pipeline yet" : `${leadCounts.total} in the pipeline`}
        />
        <StatCard
          label="Active clients"
          value={recurring.clients}
          icon="briefcase"
          href={appRoutes.adminClients}
          caption={pendingClients > 0 ? `${pendingClients} still pending` : clientCount > 0 ? `${clientCount} on the books` : "None yet"}
        />
        <RevenueCard cents={recurring.cents} />
        <StatCard label="Overdue" value={overdue} icon="alert-triangle" caption="Past the deadline, still open" />
      </section>

      <div className="flex flex-wrap gap-5">
        <div className="min-w-0 flex-[999_1_35rem]">
          <Panel title="Latest leads" action={<ViewAll href={appRoutes.adminLeads}>All leads</ViewAll>}>
            <LeadsTable
              variant="summary"
              selectable={false}
              leads={recentLeads.leads}
              caption="Latest leads"
              empty={<EmptyState compact headingLevel={3} title="No leads yet" description="They appear here as soon as someone sends the discovery call form." />}
            />
          </Panel>
        </div>
        <aside aria-label="This week" className="flex min-w-0 flex-[1_1_18rem] lg:max-w-[23.75rem]">
          <ThisWeekCard items={coming} today={todayIn(BOOKING_TIME_ZONE, now)} calendarHref={appRoutes.adminDemos} empty="Nothing on the calendar this week." />
        </aside>
      </div>

      <PackageMix rows={packageMix(packageRows, packageNames)} />
      <VaLoad rows={vaLoad(openVas, assignments, performanceByVa(taskMetrics, now))} />

      <Panel title="Latest accounts" action={<ViewAll href={appRoutes.adminUsers}>Teams</ViewAll>}>
        <UsersTable users={recentUsers} headingLevel={3} />
      </Panel>
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
