import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes, leadgenLeadHref } from "@/content/routes";
import { LEAD_VIEWS } from "@/features/leads/contract";
import { LeadSearch } from "@/features/leads/components/lead-search";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LeadsToolbar } from "@/features/leads/components/leads-toolbar";
import { listLeads } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";
import { disabledFrom, filterFrom, listHref, pageFrom, searchFrom } from "../../admin/_components/search-params";

export const metadata: Metadata = { title: "Leads" };

export default function LeadgenLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenLeads searchParams={searchParams} />
    </Suspense>
  );
}

async function LeadgenLeads({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["closer"]);
  const query = await searchParams;
  const disabled = disabledFrom(query.disabled);
  const status = disabled ? undefined : filterFrom(query.status, LEAD_VIEWS);
  const q = searchFrom(query.q);
  const { leads, total, page, pageCount } = await listLeads({ page: pageFrom(query.page), status, search: q, disabled });
  const count = total === 1 ? "1 lead" : `${total} leads`;

  return (
    <Workspace
      title="Leads"
      actions={
        <>
          <LeadSearch path={appRoutes.leadgenLeads} />
          <LeadsToolbar status={status} disabled={disabled} query={q} path={appRoutes.leadgenLeads} />
        </>
      }
    >
      <div className="grid gap-4">
        <LeadsTable
          keepHeader
          hrefFor={leadgenLeadHref}
          leads={leads}
          empty={
            <p className="m-0">
              {q ? "No leads match that search." : disabled ? "No disabled leads." : status ? `No leads in ${LEAD_VIEWS[status]}.` : "No leads yet. They show up here when you create one, or when you confirm a discovery call."}
            </p>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{count}</p>
          <Pagination label="Lead pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.leadgenLeads, { status, disabled, q, page: p })} />
        </div>
      </div>
    </Workspace>
  );
}
