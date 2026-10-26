import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskStatusForm } from "@/features/tasks/components/task-status-form";
import { TaskSummary } from "@/features/tasks/components/task-table";
import { getTask, listActiveVas, listTaskComments } from "@/features/tasks/dal";
import { nextStatuses } from "@/features/tasks/metrics";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Task" };

export default function VaTaskPage({ params }: PageProps<"/va/tasks/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaTask params={params} />
    </Suspense>
  );
}

async function VaTask({ params }: { params: PageProps<"/va/tasks/[id]">["params"] }) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const [comments, vas] = await Promise.all([listTaskComments(task.id), listActiveVas(task.clientId)]);
  const canWrite = vas.some((va) => va.id === task.vaId);
  const options = canWrite
    ? nextStatuses(task.status, "va").map((status) => ({
        status,
        label: status === "done" ? "Mark done" : "Start task",
      }))
    : [];

  return (
    <Workspace title="Task" breadcrumbs={<Breadcrumbs items={[{ label: "Tasks", href: appRoutes.vaTasks }, { label: "Task" }]} />}>
      <TaskSummary task={task} />
      <TaskStatusForm taskId={task.id} options={options} />
      <TaskComments taskId={task.id} comments={comments} canComment={canWrite} />
    </Workspace>
  );
}
