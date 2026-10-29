import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes, vaTaskFileHref } from "@/content/routes";
import { TaskPage } from "@/features/tasks/components/task-page";
import { getTask, listActiveVas, listTaskAttachments, listTaskComments, listTaskEvents, listWorkSessions } from "@/features/tasks/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Task" };

/** Every VA works Philippine hours, so times on the task read in that zone. */
const VA_TIME_ZONE = "Asia/Manila";

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

  const [comments, vas, attachments, events, sessions] = await Promise.all([
    listTaskComments(task.id),
    listActiveVas(task.clientId),
    listTaskAttachments(task.id),
    listTaskEvents(task.id),
    listWorkSessions([task.id]),
  ]);
  // Still on the assignment: the VA may start, submit and comment. The database checks the same (IVA24).
  const onAssignment = vas.some((va) => va.id === task.vaId);

  return (
    <Workspace compact>
      <TaskPage
        viewer="va"
        viewerId={user.id}
        task={task}
        events={events}
        sessions={sessions.get(task.id) ?? []}
        comments={comments}
        files={attachments.map((file) => ({ ...file, href: vaTaskFileHref(task.id, file.id) }))}
        timeZone={VA_TIME_ZONE}
        crumbs={[{ label: "Tasks", href: appRoutes.vaTasks }, { label: task.title }]}
        canMove={onAssignment}
        canComment={onAssignment}
        canAddFiles={false}
        edit={null}
      />
    </Workspace>
  );
}
