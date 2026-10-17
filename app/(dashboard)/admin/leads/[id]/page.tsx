import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { leadProfileTab } from "@/features/leads/contract";
import { LeadProfile } from "@/features/leads/components/lead-profile";
import { getLead, listLeadEvents } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";

// Static title: the lead's name is personal data and stays out of the tab title and browser history.
export const metadata: Metadata = { title: "Lead" };

export default function AdminLeadPage({ params, searchParams }: PageProps<"/admin/leads/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminLead params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminLead({ params, searchParams }: Pick<PageProps<"/admin/leads/[id]">, "params" | "searchParams">) {
  await requireRole(["admin"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const editing = query.edit === "1";
  const [lead, events] = await Promise.all([getLead(id), listLeadEvents(id)]);
  if (!lead) notFound();

  return (
    <Workspace
      compact
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Admin", href: appRoutes.admin },
            { label: "Leads", href: appRoutes.adminLeads },
            { label: lead.fullName },
          ]}
        />
      }
    >
      <LeadProfile lead={lead} events={events} tab={leadProfileTab(query.tab)} editing={editing} />
    </Workspace>
  );
}
