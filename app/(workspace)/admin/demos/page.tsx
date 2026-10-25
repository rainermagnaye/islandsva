import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes } from "@/content/routes";
import { listAllDemos } from "@/features/demos/admin-dal";
import { AdminDemosTable } from "@/features/demos/components/admin-demos-table";
import { ADMIN_DEMO_FILTERS } from "@/features/demos/contract";
import { LeadTabs } from "@/features/leads/components/lead-tabs";
import { requireRole } from "@/lib/auth/session";
import { filterFrom, listHref, pageFrom } from "../_components/search-params";

export const metadata: Metadata = { title: "Demo calls" };

export default function AdminDemosPage({ searchParams }: PageProps<"/admin/demos">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminDemos searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminDemos({ searchParams }: Pick<PageProps<"/admin/demos">, "searchParams">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const filter = filterFrom(query.status, ADMIN_DEMO_FILTERS);
  const { demos, total, page, pageCount } = await listAllDemos({ page: pageFrom(query.page), filter });
  const count = total === 1 ? "1 demo call" : `${total} demo calls`;

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="grid gap-2">
        <h1 className="m-0 type-h1">Demo calls</h1>
        <p className="m-0 max-w-[60ch] text-ink-muted">Calls clients book with a VA before they&apos;re matched. Once a demo is done, assign the VA from the client&apos;s profile.</p>
      </div>

      <div className="grid gap-4">
        <LeadTabs
          label="Filter demo calls by status"
          tabs={[
            { href: appRoutes.adminDemos, label: "All", current: !filter, icon: "calendar" },
            ...(
              [
                ["requested", "clock"],
                ["confirmed", "check-circle"],
                ["rejected", "x-circle"],
                ["cancelled", "x"],
              ] as const
            ).map(([value, icon]) => ({ href: listHref(appRoutes.adminDemos, { status: value }), label: ADMIN_DEMO_FILTERS[value], current: filter === value, icon })),
          ]}
        />
        <AdminDemosTable
          demos={demos}
          empty={
            filter ? (
              <EmptyState
                compact
                title={`No ${ADMIN_DEMO_FILTERS[filter].toLowerCase()} demo calls`}
                action={
                  <Button href={appRoutes.adminDemos} variant="ghost" size="sm">
                    Show all
                  </Button>
                }
              />
            ) : (
              <EmptyState compact title="No demo calls yet" description="They show here as clients book times VAs have opened." />
            )
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{count}</p>
          <Pagination label="Demo call pages" page={page} totalPages={pageCount} hrefFor={(p) => listHref(appRoutes.adminDemos, { status: filter, page: p })} />
        </div>
      </div>
    </Container>
  );
}
