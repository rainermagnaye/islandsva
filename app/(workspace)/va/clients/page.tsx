import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { appRoutes } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { ClientSearch } from "@/features/clients/components/client-search";
import { listTasks } from "@/features/tasks/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { clientRows, filterRows, viewOf } from "./_components/client-rows";
import { ClientsFilter } from "./_components/clients-filter";
import { VaClientsTable } from "./_components/va-clients-table";

export const metadata: Metadata = { title: "Clients" };

const SEARCH_MAX = 100;

export default function VaClientsPage({ searchParams }: PageProps<"/va/clients">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaClients searchParams={searchParams} />
    </Suspense>
  );
}

async function VaClients({ searchParams }: Pick<PageProps<"/va/clients">, "searchParams">) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, SEARCH_MAX) : "";
  const view = viewOf(params.view);

  // Both run as the signed-in VA, so RLS keeps them to the VA's own clients and tasks.
  const [clients, tasks] = await Promise.all([listAssignedClients(user.id), listTasks()]);
  const now = new Date();
  const rows = clientRows(clients, tasks, now);
  const shown = filterRows(rows, query, view);

  const agreed = rows.reduce((sum, row) => sum + (row.hoursPerWeek ?? 0), 0);
  const open = rows.reduce((sum, row) => sum + row.open, 0);
  const overdue = rows.reduce((sum, row) => sum + row.overdue, 0);
  const settingUp = rows.filter((row) => row.time === null || row.hoursPerWeek === null).length;

  return (
    <Workspace
      title="Clients"
      actions={
        rows.length > 0 ? (
          <>
            <ClientSearch path={appRoutes.vaClients} />
            <ClientsFilter view={view} query={query} />
          </>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" description="An admin assigns clients to you. They'll show here once you're matched." />
      ) : (
        <>
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Active clients" value={rows.length} icon="briefcase" caption={settingUp > 0 ? `${settingUp} still being set up` : "All set up"} />
            {/* Agreed hours only: hours worked come with timesheets (M14). */}
            <StatCard label="Agreed hours" value={agreed > 0 ? agreed : null} unit="h a week" icon="clock" caption="Across your clients" />
            <StatCard
              label="Open tasks"
              value={open}
              icon="check"
              href={appRoutes.vaTasks}
              caption={overdue > 0 ? `${overdue} overdue` : "Nothing overdue"}
            />
          </section>

          <VaClientsTable
            rows={shown}
            empty={<EmptyState compact title="No clients match" description="Try another name, or choose All Clients in Filter." />}
          />
        </>
      )}
    </Workspace>
  );
}
