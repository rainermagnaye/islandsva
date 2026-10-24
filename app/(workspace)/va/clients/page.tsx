import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { AssignedClientsTable } from "@/features/clients/components/assigned-clients-table";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default function VaClientsPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaClients />
    </Suspense>
  );
}

async function VaClients() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const clients = await listAssignedClients(user.id);

  return (
    <Workspace title="Clients" lead="The clients you work with, their time zone and agreed hours.">
      <AssignedClientsTable
        caption="Your clients"
        clients={clients}
        empty={<EmptyState compact title="No clients yet" description="An admin assigns clients to you. They'll show here once you're matched." />}
      />
    </Workspace>
  );
}
