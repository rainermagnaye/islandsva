import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes, clientTaskFileHref, clientVaHref } from "@/content/routes";
import { TaskPage } from "@/features/tasks/components/task-page";
import { getOwnCompany, getTask, listTaskAttachments, listTaskComments, listTaskEvents, listWorkSessions } from "@/features/tasks/dal";
import { deadlineWindow, taskTimeZone } from "@/features/tasks/metrics";
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

  const [company, comments, attachments, events, sessions] = await Promise.all([
    getOwnCompany(user.id),
    listTaskComments(task.id),
    listTaskAttachments(task.id),
    listTaskEvents(task.id),
    listWorkSessions([task.id]),
  ]);
  const timeZone = task.deadlineTimezone || taskTimeZone(company?.timezone);
  const window = deadlineWindow(timeZone);
  const companyOpen = company?.status === "active" && company.disabledAt === null;
  const open = task.status !== "done";
  // The client may always decide a review or close (canMove). Sending work back also needs the VA on the
  // assignment: the database checks that (IVA24) and the action says so.

  return (
    <Workspace compact>
      <TaskPage
        viewer="client"
        viewerId={user.id}
        task={task}
        events={events}
        sessions={sessions.get(task.id) ?? []}
        comments={comments}
        files={attachments.map((file) => ({ ...file, href: clientTaskFileHref(task.id, file.id) }))}
        timeZone={timeZone}
        crumbs={[
          { label: "Dashboard", href: appRoutes.client },
          { label: "My assistants", href: appRoutes.clientAssistants },
          { label: task.vaFirstName, href: clientVaHref(task.vaId) },
          { label: task.title },
        ]}
        vaHref={clientVaHref(task.vaId)}
        canMove
        canComment
        canAddFiles={open && companyOpen}
        edit={open && companyOpen && window ? { today: window.today, last: window.last, timeZone } : null}
      />
    </Workspace>
  );
}
