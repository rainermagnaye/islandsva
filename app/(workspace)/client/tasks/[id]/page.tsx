import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Panel } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskForm } from "@/features/tasks/components/task-form";
import { TaskStatusForm } from "@/features/tasks/components/task-status-form";
import { TaskSummary } from "@/features/tasks/components/task-table";
import { getOwnCompany, getTask, listTaskComments } from "@/features/tasks/dal";
import { deadlineWindow, nextStatuses } from "@/features/tasks/metrics";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Task" };

export default function ClientTaskPage({ params }: PageProps<"/client/tasks/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientTask params={params} />
    </Suspense>
  );
}

async function ClientTask({ params }: { params: PageProps<"/client/tasks/[id]">["params"] }) {
  const user = await requireRole(["client"]);
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const [company, comments] = await Promise.all([getOwnCompany(user.id), listTaskComments(task.id)]);
  const window = company?.timezone ? deadlineWindow(company.timezone) : null;
  const companyOpen = company?.status === "active" && company.disabledAt === null;
  const options = nextStatuses(task.status, "client").map((status) => ({
    status,
    label: "Close task",
  }));

  return (
    <Workspace title="Task" breadcrumbs={<Breadcrumbs items={[{ label: "Tasks", href: appRoutes.clientTasks }, { label: "Task" }]} />}>
      <TaskSummary task={task} />
      {task.status !== "done" && companyOpen && window && company?.timezone && (
        <Panel title="Title and deadline" headingLevel={2}>
          <TaskForm today={window.today} last={window.last} timeZone={company.timezone} task={task} />
        </Panel>
      )}
      <TaskStatusForm taskId={task.id} options={options} />
      <TaskComments taskId={task.id} comments={comments} canComment />
    </Workspace>
  );
}
