import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes } from "@/content/routes";
import { LEAD_STATUS_LABELS } from "@/features/leads/contract";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { listLeads } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";
import { FilterTabs } from "../_components/filter-tabs";
import { filterFrom, listHref, pageFrom } from "../_components/search-params";

export const metadata: Metadata = { title: "Leads" };

export default function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminLeads searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminLeads({ searchParams }: Pick<PageProps<"/admin/leads">, "searchParams">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const status = filterFrom(query.status, LEAD_STATUS_LABELS);
  const { leads, total, page, pageCount } = await listLeads({ page: pageFrom(query.page), status });
  const statusWord = status && LEAD_STATUS_LABELS[status].toLowerCase();

  return (
    <Workspace title="Leads" lead="Everyone who has sent the contact form, newest first. Open a lead to read their message and update it.">
      <FilterTabs label="Filter leads by status" href={appRoutes.adminLeads} options={LEAD_STATUS_LABELS} current={status} />
      <p className="m-0 type-body-sm text-ink-muted" role="status">
        {total === 1 ? "1 lead" : `${total} leads`}
        {statusWord && ` marked ${statusWord}`}
      </p>
      <LeadsTable
        leads={leads}
        empty={
          status ? (
            <EmptyState
              compact
              title={`No ${statusWord} leads`}
              description="Leads move here as you update them."
              action={
                <Button href={appRoutes.adminLeads} variant="ghost" size="sm">
                  Show all leads
                </Button>
              }
            />
          ) : undefined
        }
      />
      <Pagination label="Lead pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.adminLeads, { status, page: p })} />
    </Workspace>
  );
}
