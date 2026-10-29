import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { StatCard } from "@/components/ui/stat-card";
import { packages } from "@/content/packages";
import { adminUserHref, appRoutes, clientTaskHref } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { VaMessageButton } from "@/features/clients/components/va-message-button";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { listVaMessages } from "@/features/clients/message-dal";
import { AddTaskButton } from "@/features/tasks/components/add-task-button";
import { VaTaskTabs, type VaTaskRow } from "@/features/tasks/components/va-task-tabs";
import type { Task } from "@/features/tasks/contract";
import { getOwnCompany, listTasks } from "@/features/tasks/dal";
import { calendarDate, deadlineWindow, isOverdue, taskTimeZone } from "@/features/tasks/metrics";
import { employeeHasAvatar } from "@/features/users/employee-dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Virtual assistant" };

/** Every VA works Philippine hours; the header shows their time beside the client's. */
const VA_TIME_ZONE = "Asia/Manila";

export default function ClientVaPage({ params }: PageProps<"/client/vas/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientVa params={params} />
    </Suspense>
  );
}

async function ClientVa({ params }: { params: PageProps<"/client/vas/[id]">["params"] }) {
  const user = await requireRole(["client"]);
  const { id } = await params;
  const clientId = await getOwnClientId(user.id);
  if (!clientId) notFound();
  const [client, company, assignments, tasks, messages] = await Promise.all([
    getClient(clientId),
    getOwnCompany(user.id),
    listActiveAssignments(clientId),
    listTasks(),
    listVaMessages(clientId, id),
  ]);
  const va = assignments.find((assignment) => assignment.vaId === id);
  if (!client || !va) notFound();
  const hasPhoto = await employeeHasAvatar(id);

  const now = new Date();
  const pkg = packages.find((item) => item.slug === client.packageCode);
  const zone = taskTimeZone(company?.timezone);
  const window = deadlineWindow(zone);
  const canCreate = company?.status === "active" && company.disabledAt === null && window !== null;
  const name = va.vaName.trim().split(/\s+/)[0] || va.vaName;
  const hours = client.hoursPerWeek || pkg?.weeklyHours || 0;

  const theirs = tasks.filter((task) => task.vaId === id);
  const rows: VaTaskRow[] = theirs.map((task) => ({
    id: task.id,
    href: clientTaskHref(task.id),
    title: task.title,
    status: task.status,
    added: when(task.createdAt, zone),
    due: dueLabel(task),
    overdue: isOverdue(task, now),
    completed: task.doneAt ? when(task.doneAt, zone) : null,
  }));
  const thisMonth = calendarDate(now, zone).slice(0, 7);
  const completedThisMonth = theirs.filter((task) => task.doneAt && calendarDate(new Date(task.doneAt), zone).slice(0, 7) === thisMonth).length;
  const openCount = theirs.length - theirs.filter((task) => task.status === "done").length;

  return (
    <Workspace compact breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", href: appRoutes.client }, { label: "My assistants", href: appRoutes.clientAssistants }, { label: name }]} />}>
      <Card as="section" aria-label={name} className="flex flex-wrap items-center gap-5">
        <Avatar name={va.vaName} src={hasPhoto ? `${adminUserHref(id)}/avatar` : undefined} size="lg" />
        <div className="grid min-w-0 flex-[1_1_18rem] gap-1">
          <h1 className="m-0 type-h1">{name}</h1>
          <p className="m-0 type-body-sm text-ink-muted">
            {[pkg?.name ?? "Package once it's confirmed", hours ? `${hours} hours a week` : null, localTimes(now, zone)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <VaMessageButton
            name={name}
            vaId={id}
            messages={messages.map((message) => ({
              id: message.id,
              body: message.body,
              sent: when(message.createdAt, zone),
              author: message.authorId === user.id ? "You" : name,
            }))}
          />
          {canCreate && window && <AddTaskButton va={{ id, firstName: name }} today={window.today} last={window.last} timeZone={zone} />}
        </div>
      </Card>

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tasks" value={openCount} icon="inbox" caption={`Waiting for ${name}`} />
        <StatCard label="Completed this month" value={completedThisMonth} icon="check-circle" caption="In your time zone" />
        <StatCard label="Hours included" value={hours} unit="hrs / week" icon="clock" caption={hours ? "Hours worked aren't recorded yet" : "Once the package is confirmed"} />
      </section>

      <Card as="section" aria-label={`${name}'s work`} className="pt-2">
        <VaTaskTabs
          tasks={rows}
          plan={
            <div className="grid gap-6 md:grid-cols-2">
              <Alert tone="info" title="Hours worked aren't recorded yet">
                For now this shows the hours included in your package.
              </Alert>
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 type-body-sm">
                <dt className="font-semibold text-ink-muted">Package</dt>
                <dd className="m-0">{pkg?.name ?? "Once it's confirmed"}</dd>
                <dt className="font-semibold text-ink-muted">Hours included</dt>
                <dd className="m-0">{hours ? `${hours} hours a week` : "Once it's confirmed"}</dd>
                {client.termMonths ? (
                  <>
                    <dt className="font-semibold text-ink-muted">Term</dt>
                    <dd className="m-0">{client.termMonths === 1 ? "1 month" : `${client.termMonths} months`}</dd>
                  </>
                ) : null}
                {client.startsOn ? (
                  <>
                    <dt className="font-semibold text-ink-muted">Started</dt>
                    <dd className="m-0">{formatDate(client.startsOn, { dateStyle: "medium" })}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          }
        />
      </Card>
    </Workspace>
  );
}

function when(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function dueLabel(task: Pick<Task, "deadline" | "deadlineTime">) {
  const day = formatDate(task.deadline, { dateStyle: "medium" });
  return task.deadlineTime ? `${day}, ${clockLabel(minutesOf(task.deadlineTime))}` : day;
}

/** "9:42 AM in Manila, 9:42 PM for you", or just Manila's time when the client is in the same zone. */
function localTimes(now: Date, clientZone: string) {
  const clock = (timeZone: string) => new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(now);
  const manila = `${clock(VA_TIME_ZONE)} in Manila`;
  return clientZone === VA_TIME_ZONE ? manila : `${manila}, ${clock(clientZone)} for you`;
}
