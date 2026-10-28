import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes, clientTaskHref } from "@/content/routes";
import { AddTaskButton } from "@/features/tasks/components/add-task-button";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { TaskTable } from "@/features/tasks/components/task-table";
import { getOwnCompany, listActiveVas, listTasks } from "@/features/tasks/dal";
import { deadlineWindow, taskTimeZone } from "@/features/tasks/metrics";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tasks" };

export default function ClientTasksPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientTasks />
    </Suspense>
  );
}

async function ClientTasks() {
  const user = await requireRole(["client"]);
  const company = await getOwnCompany(user.id);
  if (!company) {
    return (
      <Workspace title="Tasks">
        <EmptyState title="Your account is being set up" description="Your Islands VA contact is finishing your setup. Check back soon, or reply to their email." />
      </Workspace>
    );
  }

  const [tasks, vas] = await Promise.all([listTasks(), listActiveVas(company.id)]);
  const timeZone = taskTimeZone(company.timezone);
  const window = deadlineWindow(timeZone);
  const canCreate = company.status === "active" && company.disabledAt === null && window !== null && vas.length >= 1;

  return (
    <Workspace
      title="Tasks"
      lead="Work for your VA, with a title and a deadline."
      actions={canCreate && window ? <AddTaskButton vas={vas} today={window.today} last={window.last} timeZone={timeZone} /> : undefined}
    >
      <TaskMetrics tasks={tasks} href={appRoutes.clientTasks} />
      <TaskTable
        tasks={tasks}
        hrefFor={clientTaskHref}
        empty={
          canCreate ? (
            <EmptyState compact title="No tasks yet" description="Add a task with a deadline for your VA." />
          ) : (
            <EmptyState compact title="No tasks yet" description="Tasks can be added once your company is active and a VA is working with you." />
          )
        }
      />
    </Workspace>
  );
}
