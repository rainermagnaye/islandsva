import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes } from "@/content/routes";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { CLIENT_STATUS_LABELS } from "@/features/clients/contract";
import { listClients } from "@/features/clients/dal";
import { requireRole } from "@/lib/auth/session";
import { FilterTabs, filterFrom } from "../_components/filter-tabs";
import { Pagination, pageFrom } from "../_components/pagination";

export const metadata: Metadata = { title: "Clients" };

export default function AdminClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminClients searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminClients({ searchParams }: Pick<PageProps<"/admin/clients">, "searchParams">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const status = filterFrom(query.status, CLIENT_STATUS_LABELS);
  const { clients, total, page, pageCount } = await listClients({ page: pageFrom(query.page), status });

  return (
    <Workspace title="Clients" lead="Every client company, newest first. New clients stay pending until they're onboarded and activated.">
      <FilterTabs label="Filter clients by status" href={appRoutes.adminClients} options={CLIENT_STATUS_LABELS} current={status} />
      <p className="m-0 type-body-sm text-ink-muted" role="status">
        {total === 1 ? "1 client" : `${total} clients`}
        {status && ` ${CLIENT_STATUS_LABELS[status].toLowerCase()}`}
      </p>
      <ClientsTable
        clients={clients}
        empty={status ? "No clients with this status." : "No clients yet. Convert a lead to create the first one."}
      />
      <Pagination label="Client pages" href={appRoutes.adminClients} page={page} pageCount={pageCount} params={{ status }} />
    </Workspace>
  );
}
