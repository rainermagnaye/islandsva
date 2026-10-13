import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes } from "@/content/routes";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { listLeads } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Leads" };

export default function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminLeads searchParams={searchParams} />
    </Suspense>
  );
}

/** `?page=` as a positive integer; anything else is page 1. */
function pageFrom(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

async function AdminLeads({ searchParams }: Pick<PageProps<"/admin/leads">, "searchParams">) {
  await requireRole(["admin"]);
  const { leads, total, page, pageCount } = await listLeads({ page: pageFrom((await searchParams).page) });

  return (
    <Workspace title="Leads" lead={`Everyone who has sent the contact form, newest first (${total} in total).`}>
      <LeadsTable leads={leads} />
      {pageCount > 1 && (
        <nav aria-label="Lead pages" className="flex items-center justify-between gap-4 type-label">
          {page > 1 ? <Link href={`${appRoutes.adminLeads}?page=${Math.min(page - 1, pageCount)}`}>Newer</Link> : <span />}
          <span className="text-ink-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? <Link href={`${appRoutes.adminLeads}?page=${page + 1}`}>Older</Link> : <span />}
        </nav>
      )}
    </Workspace>
  );
}
