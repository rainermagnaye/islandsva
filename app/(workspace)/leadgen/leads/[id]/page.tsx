import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { leadProfileTab } from "@/features/leads/contract";
import { LeadProfile } from "@/features/leads/components/lead-profile";
import { getLead, listLeadEvents } from "@/features/leads/dal";
import { listLeadBookings } from "@/features/meetings/booking-dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lead" };

export default function LeadgenLeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenLead params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LeadgenLead({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const user = await requireRole(["closer"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [lead, events, meetings] = await Promise.all([getLead(id), listLeadEvents(id), listLeadBookings(id)]);
  if (!lead) notFound();

  return (
    <Workspace
      compact
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: appRoutes.leadgen },
            { label: "Leads", href: appRoutes.leadgenLeads },
            { label: lead.fullName },
          ]}
        />
      }
    >
      <LeadProfile lead={lead} events={events} meetings={meetings} viewerId={user.id} tab={leadProfileTab(query.tab)} editing={false} audience="closer" />
    </Workspace>
  );
}
