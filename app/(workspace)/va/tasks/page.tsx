import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { TaskTable } from "@/features/tasks/components/task-table";
import { listTasks } from "@/features/tasks/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tasks" };

export default function VaTasksPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaTasks />
    </Suspense>
  );
}

async function VaTasks() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const tasks = await listTasks();

  return (
    <Workspace title="Tasks" lead="Tasks across your clients, and how many are done, on time or overdue.">
      <TaskMetrics tasks={tasks} href={appRoutes.vaTasks} />
      <TaskTable
        tasks={tasks}
        hrefFor={vaTaskHref}
        empty={<EmptyState compact title="No tasks yet" description="When a client adds a task for you, it shows up here." />}
      />
    </Workspace>
  );
}
