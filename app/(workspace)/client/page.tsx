import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { getActiveAssignment, getVaFirstName } from "@/features/clients/assignment-dal";
import { ClientDashboard } from "@/features/clients/components/client-dashboard";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your dashboard" };

export default function ClientHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientHome />
    </Suspense>
  );
}

async function ClientHome() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record and its assignment.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) {
    return (
      <Workspace title="Your dashboard">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }
  const assignment = await getActiveAssignment(client.id);
  const va = assignment ? { firstName: await getVaFirstName(assignment.vaId), startedAt: assignment.startedAt } : null;

  return (
    <Workspace title={`Welcome, ${client.companyName}`} lead="Your VA and your plan, in one place.">
      <ClientDashboard client={client} va={va} />
    </Workspace>
  );
}
