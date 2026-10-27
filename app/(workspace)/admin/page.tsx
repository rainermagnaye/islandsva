import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { packages } from "@/content/packages";
import { appRoutes } from "@/content/routes";
import { countOpenRequests } from "@/features/demos/admin-dal";
import { listActiveAssignmentLoads } from "@/features/clients/assignment-dal";
import { countClients, listActivePackageRows } from "@/features/clients/dal";
import { vaLoad } from "@/features/clients/load";
import { packageMix } from "@/features/clients/mix";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { listDiscoveryTimes } from "@/features/meetings/dal";
import { countLeads, listLeads } from "@/features/leads/dal";
import { recurringRevenue } from "@/features/sales/dal";
import { listTaskMetrics } from "@/features/tasks/dal";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { performanceByVa } from "@/features/tasks/metrics";
import { vaPortalOpen } from "@/features/users/contract";
import { listUsers, listVaRoster } from "@/features/users/dal";
import { UsersTable } from "@/features/users/components/users-table";
import { requireRole } from "@/lib/auth/session";
import { PackageMix, RevenueCard, VaLoad } from "./_components/overview-tables";
import { listHref } from "./_components/search-params";

export const metadata: Metadata = { title: "Dashboard" };

const RECENT = 5;
const packageNames = Object.fromEntries(packages.map((item) => [item.slug, item.name]));

export default function AdminHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await requireRole(["admin"]);
  // Independent reads, fetched in parallel. Each runs as the signed-in admin, so RLS applies too.
  const [leadCounts, clientCount, openRequests, recentLeads, recentUsers, recurring, packageRows, assignments, roster, taskMetrics, discovery] = await Promise.all([
    countLeads(),
    countClients(),
    countOpenRequests(),
    listLeads({ pageSize: RECENT }),
    listUsers(RECENT),
    recurringRevenue(),
    listActivePackageRows(),
    listActiveAssignmentLoads(),
    listVaRoster(),
    listTaskMetrics(),
    listDiscoveryTimes(),
  ]);
  const openVas = roster
    .filter((va) => va.roles.includes("va") && vaPortalOpen(va.status, va.reviewStatus))
    .map((va) => ({ id: va.id, firstName: va.fullName }));

  return (
    <Workspace title="Dashboard" lead="Pipeline, clients, packages and how your VAs are loaded.">
      {discovery.times.length === 0 && (
        <p className="m-0 type-body-sm text-ink-muted">
          Visitors can&apos;t request a discovery call yet. <Link href={appRoutes.adminSettings}>Set discovery times</Link>
        </p>
      )}
      <section aria-label="Pipeline" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total leads" value={leadCounts.total} icon="inbox" href={appRoutes.adminLeads} />
        <StatCard label="New" value={leadCounts.new} icon="bell" href={appRoutes.adminLeads} />
        <StatCard label="Contacted" value={leadCounts.contacted} icon="inbox" href={listHref(appRoutes.adminLeads, { status: "contacted" })} />
        <StatCard label="Qualified" value={leadCounts.qualified} icon="inbox" href={appRoutes.adminLeads} />
        <StatCard label="Converted" value={leadCounts.converted} icon="check" href={listHref(appRoutes.adminLeads, { status: "converted" })} />
        <StatCard label="Closed" value={leadCounts.closed} icon="inbox" href={listHref(appRoutes.adminLeads, { status: "closed" })} caption="Junk leads" />
      </section>

      <section aria-label="Clients" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total clients" value={clientCount} icon="briefcase" href={appRoutes.adminClients} />
        <StatCard label="Active clients" value={recurring.clients} icon="briefcase" href={appRoutes.adminClients} />
        <RevenueCard cents={recurring.cents} />
        <StatCard label="Demo requests" value={openRequests} icon="calendar" href={appRoutes.adminDemos} caption="Waiting for a VA" />
      </section>

      <PackageMix rows={packageMix(packageRows, packageNames)} />
      <TaskMetrics tasks={taskMetrics} />
      <VaLoad rows={vaLoad(openVas, assignments, performanceByVa(taskMetrics, new Date()))} />

      <Panel title="Latest leads" action={<ViewAll href={appRoutes.adminLeads}>All leads</ViewAll>}>
        <LeadsTable
          variant="summary"
          leads={recentLeads.leads}
          caption="Latest leads"
          empty={<EmptyState compact headingLevel={3} title="No leads yet" description="They appear here as soon as someone sends the discovery call form." />}
        />
      </Panel>

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
