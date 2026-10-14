import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { appRoutes } from "@/content/routes";
import { countClients } from "@/features/clients/dal";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { countLeads, listLeads } from "@/features/leads/dal";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin" };

const RECENT = 5;

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
  const [leadCounts, clientCount, recentLeads, recentUsers] = await Promise.all([
    countLeads(),
    countClients(),
    listLeads({ pageSize: RECENT }),
    listUsers(RECENT),
  ]);

  return (
    <Workspace title="Admin" lead="Leads, clients and your team at a glance.">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total leads" value={leadCounts.total} icon="inbox" href={appRoutes.adminLeads} />
        <StatCard label="New leads" value={leadCounts.new} icon="bell" href={appRoutes.adminLeads} />
        <StatCard label="Total clients" value={clientCount} icon="briefcase" href={appRoutes.adminClients} />
      </section>

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
