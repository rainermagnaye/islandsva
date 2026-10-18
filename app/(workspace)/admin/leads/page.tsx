import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Container } from "@/components/ui/container";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes } from "@/content/routes";
import { LEAD_VIEWS } from "@/features/leads/contract";
import { LeadSearch } from "@/features/leads/components/lead-search";
import { LeadTabs } from "@/features/leads/components/lead-tabs";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LeadsToolbar } from "@/features/leads/components/leads-toolbar";
import { listLeads } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";
import { disabledFrom, filterFrom, listHref, pageFrom, searchFrom } from "../_components/search-params";

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
  const disabled = disabledFrom(query.disabled);
  const status = disabled ? undefined : filterFrom(query.status, LEAD_VIEWS);
  const q = searchFrom(query.q);
  const { leads, total, page, pageCount } = await listLeads({ page: pageFrom(query.page), status, search: q, disabled });
  const count = total === 1 ? "1 lead" : `${total} leads`;

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 type-h1">Leads</h1>
        <div className="flex flex-wrap items-center gap-3">
          <LeadSearch />
          <LeadsToolbar status={status} disabled={disabled} query={q} />
        </div>
      </div>

      <div className="grid gap-4">
        <LeadTabs
          label="Filter leads by status"
          tabs={[
            { href: listHref(appRoutes.adminLeads, { q }), label: "All Leads", current: !status && !disabled, icon: "inbox" },
            ...(
              [
                ["contacted", "message"],
                ["converted", "check-circle"],
              ] as const
            ).map(([value, icon]) => ({
              href: listHref(appRoutes.adminLeads, { status: value, q }),
              label: LEAD_VIEWS[value],
              current: status === value,
              icon,
            })),
          ]}
        />
        <LeadsTable
          keepHeader
          leads={leads}
          empty={
            <p className="m-0">
              {q ? "No leads match that search." : disabled ? "No disabled leads." : status ? `No leads in ${LEAD_VIEWS[status]}.` : "No leads yet. They show up here from the discovery form, or when you create one."}
            </p>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{count}</p>
          <Pagination label="Lead pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.adminLeads, { status, disabled, q, page: p })} />
        </div>
      </div>
    </Container>
  );
}
