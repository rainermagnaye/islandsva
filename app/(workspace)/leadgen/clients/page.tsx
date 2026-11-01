import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes, leadgenClientHref } from "@/content/routes";
import { ClientSearch } from "@/features/clients/components/client-search";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { ClientsToolbar } from "@/features/clients/components/clients-toolbar";
import { CLIENT_STATUS_LABELS } from "@/features/clients/contract";
import { listClients } from "@/features/clients/dal";
import { requireRole } from "@/lib/auth/session";
import { disabledFrom, filterFrom, listHref, pageFrom, searchFrom } from "../../admin/_components/search-params";

export const metadata: Metadata = { title: "Clients" };

export default function LeadgenClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenClients searchParams={searchParams} />
    </Suspense>
  );
}

async function LeadgenClients({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["closer"]);
  const query = await searchParams;
  const disabled = disabledFrom(query.disabled);
  const status = disabled ? undefined : filterFrom(query.status, CLIENT_STATUS_LABELS);
  const q = searchFrom(query.q);
  const { clients, total, page, pageCount } = await listClients({ page: pageFrom(query.page), status, search: q, disabled });
  const count = total === 1 ? "1 client" : `${total} clients`;
  const statusWord = disabled ? "disabled" : status ? CLIENT_STATUS_LABELS[status].toLowerCase() : "";

  return (
    <Workspace
      title="Clients"
      actions={
        <>
          <ClientSearch path={appRoutes.leadgenClients} />
          <ClientsToolbar status={status} disabled={disabled} query={q} path={appRoutes.leadgenClients} createHref={appRoutes.leadgenNewClient} />
        </>
      }
    >
      <div className="grid gap-4">
        <ClientsTable
          keepHeader
          clients={clients}
          hrefFor={leadgenClientHref}
          empty={
            <EmptyState
              compact
              title={q ? "No clients match that search." : statusWord ? `No ${statusWord} clients.` : "No clients yet"}
              description={q || statusWord ? undefined : "Add the first client you've agreed a package with."}
            />
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{count}</p>
          <Pagination label="Client pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.leadgenClients, { status, disabled, q, page: p })} />
        </div>
      </div>
    </Workspace>
  );
}
