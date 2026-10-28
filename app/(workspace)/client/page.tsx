import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { adminUserHref, appRoutes } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { ClientDashboard } from "@/features/clients/components/client-dashboard";
import { getLatestDemo } from "@/features/demos/booking-dal";
import { ClientDemoCard } from "@/features/demos/components/client-demo-card";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { ClientTaskBoard } from "@/features/tasks/components/client-task-board";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { getOwnCompany, listTasks } from "@/features/tasks/dal";
import { deadlineWindow, taskTimeZone } from "@/features/tasks/metrics";
import { employeeHasAvatar } from "@/features/users/employee-dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

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
      <Workspace title="Dashboard">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }
  const [assignments, company, tasks] = await Promise.all([listActiveAssignments(client.id), getOwnCompany(user.id), listTasks()]);
  const photos = await Promise.all(assignments.map((assignment) => employeeHasAvatar(assignment.vaId)));
  const vas = assignments.map((assignment, index) => {
    const theirs = tasks.filter((task) => task.vaId === assignment.vaId);
    return {
      id: assignment.vaId,
      firstName: assignment.vaName,
      photoSrc: photos[index] ? `${adminUserHref(assignment.vaId)}/avatar` : undefined,
      done: theirs.filter((task) => task.status === "done").length,
      pending: theirs.filter((task) => task.status !== "done").length,
    };
  });
  const demo = vas.length > 0 ? null : await getLatestDemo(client.id);
  const formVas = assignments.map((assignment) => ({ id: assignment.vaId, firstName: assignment.vaName }));
  const timeZone = taskTimeZone(company?.timezone);
  const window = deadlineWindow(timeZone);

  return (
    <Workspace title="Dashboard">
      <TaskMetrics tasks={tasks} href={appRoutes.clientTasks} />
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(14rem,18rem)]">
        <ClientTaskBoard
          tasks={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            vaFirstName: task.vaFirstName,
            deadline: task.deadline,
            deadlineTime: task.deadlineTime,
          }))}
          today={window?.today ?? ""}
          last={window?.last ?? ""}
          timeZone={timeZone}
          vas={formVas}
        />
        <ClientDashboard vas={vas} empty={<ClientDemoCard demo={demo} timeZone={client.timezone} />} />
      </div>
    </Workspace>
  );
}
