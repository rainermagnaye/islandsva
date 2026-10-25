import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes } from "@/content/routes";
import { ClientSearch } from "@/features/clients/components/client-search";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { ClientsToolbar } from "@/features/clients/components/clients-toolbar";
import { CLIENT_STATUS_LABELS } from "@/features/clients/contract";
import { listClients } from "@/features/clients/dal";
import { requireRole } from "@/lib/auth/session";
import { disabledFrom, filterFrom, listHref, pageFrom, searchFrom } from "../_components/search-params";

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
  const disabled = disabledFrom(query.disabled);
  const status = disabled ? undefined : filterFrom(query.status, CLIENT_STATUS_LABELS);
  const q = searchFrom(query.q);
  const { clients, total, page, pageCount } = await listClients({ page: pageFrom(query.page), status, search: q, disabled });
  const count = total === 1 ? "1 client" : `${total} clients`;
  const statusWord = disabled ? "disabled" : status ? CLIENT_STATUS_LABELS[status].toLowerCase() : "";

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 type-h1">Clients</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ClientSearch />
          <ClientsToolbar status={status} disabled={disabled} query={q} />
        </div>
      </div>

      <div className="grid gap-4">
        <ClientsTable
          keepHeader
          clients={clients}
          empty={
            status || disabled || q ? (
              <EmptyState
                compact
                title={q ? "No clients match that search" : `No ${statusWord} clients`}
                description={q ? "Try another company, name, or email." : "Clients show up here as they're onboarded and activated."}
                action={
                  <Button href={listHref(appRoutes.adminClients, {})} variant="ghost" size="sm">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{count}</p>
          <Pagination label="Client pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.adminClients, { status, disabled, q, page: p })} />
        </div>
      </div>
    </Container>
  );
}
