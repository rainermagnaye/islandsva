import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { ClientDashboard } from "@/features/clients/components/client-dashboard";
import { getLatestDemo } from "@/features/demos/booking-dal";
import { ClientDemoCard } from "@/features/demos/components/client-demo-card";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { listTasks } from "@/features/tasks/dal";
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
  const assignments = await listActiveAssignments(client.id);
  const tasks = await listTasks();
  const vas = assignments.map((assignment) => ({ id: assignment.id, firstName: assignment.vaName, startedAt: assignment.startedAt }));
  const demo = vas.length > 0 ? null : await getLatestDemo(client.id);

  return (
    <Workspace title={`Welcome, ${client.companyName}`} lead="Your VA and your plan, in one place.">
      <TaskMetrics tasks={tasks} href={appRoutes.clientTasks} />
      <ClientDashboard client={client} vas={vas} beforeVa={<ClientDemoCard demo={demo} timeZone={client.timezone} />} />
    </Workspace>
  );
}
