import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes } from "@/content/routes";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { CLIENT_STATUS_LABELS } from "@/features/clients/contract";
import { listClients } from "@/features/clients/dal";
import { requireRole } from "@/lib/auth/session";
import { FilterTabs } from "../_components/filter-tabs";
import { filterFrom, listHref, pageFrom } from "../_components/search-params";

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
  const statusWord = status && CLIENT_STATUS_LABELS[status].toLowerCase();

  return (
    <Workspace title="Clients" lead="Every client company, newest first. New clients stay pending until they're onboarded and activated.">
      <FilterTabs label="Filter clients by status" href={appRoutes.adminClients} options={CLIENT_STATUS_LABELS} current={status} />
      <p className="m-0 type-body-sm text-ink-muted" role="status">
        {total === 1 ? "1 client" : `${total} clients`}
        {statusWord && ` ${statusWord}`}
      </p>
      <ClientsTable
        clients={clients}
        empty={
          status ? (
            <EmptyState
              compact
              title={`No ${statusWord} clients`}
              description="Clients move here as they're onboarded and activated."
              action={
                <Button href={appRoutes.adminClients} variant="ghost" size="sm">
                  Show all clients
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              title="No clients yet"
              description="Convert a lead to create your first client."
              action={
                <Button href={appRoutes.adminLeads} variant="secondary" size="sm">
                  Go to leads
                </Button>
              }
            />
          )
        }
      />
      <Pagination label="Client pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.adminClients, { status, page: p })} />
    </Workspace>
  );
}
