import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StatCard } from "@/components/ui/stat-card";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { TaskTable } from "@/features/tasks/components/task-table";
import { listTasks, listWorkSessions } from "@/features/tasks/dal";
import { delayedIds, formatMs } from "@/features/tasks/time";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { clientRows, VA_ZONE } from "../_components/client-rows";

// No company name in the title: page titles carry no client details (CLAUDE.md §6).
export const metadata: Metadata = { title: "Client" };

/** The newest sessions shown; the task pages have each task's full list. */
const SESSIONS_SHOWN = 8;

export default function VaClientPage({ params }: PageProps<"/va/clients/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaClient params={params} />
    </Suspense>
  );
}

async function VaClient({ params }: { params: PageProps<"/va/clients/[id]">["params"] }) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const { id } = await params;

  // Only the VA's active clients (RLS and the va_id filter): anyone else's id is a 404.
  const [clients, allTasks] = await Promise.all([listAssignedClients(user.id), listTasks()]);
  const client = clients.find((item) => item.id === id);
  if (!client) notFound();
  const tasks = allTasks.filter((task) => task.clientId === client.id);
  const sessions = await listWorkSessions(tasks.map((task) => task.id));
  const now = new Date();
  const [row] = clientRows([client], tasks, sessions, now);

  const titleOf = new Map(tasks.map((task) => [task.id, task.title]));
  const recent = [...sessions.values()]
    .flat()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, SESSIONS_SHOWN);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: VA_ZONE });
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: VA_ZONE });

  return (
    <Workspace
      title={row.company}
      breadcrumbs={<Breadcrumbs items={[{ label: "Clients", href: appRoutes.vaClients }, { label: row.company }]} />}
      actions={
        <a href={`mailto:${row.email}`} className={buttonClasses({ variant: "secondary" })}>
          <Icon name="mail" />
          <span>Email {row.contact.split(/\s+/)[0] || row.contact}</span>
        </a>
      }
    >
      <section aria-label="This week" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hours this week"
          value={row.hours?.used ?? 0}
          unit={row.hours ? `of ${row.hours.agreed} h` : "h"}
          icon="clock"
          caption={row.hours ? "From your task timers, their Monday to Sunday" : "No weekly hours agreed yet"}
        />
        <StatCard label="Open tasks" value={row.open} icon="check" />
        <StatCard label="Overdue" value={row.overdue} icon="alert-triangle" caption="Past the deadline" />
        <StatCard label="Delayed" value={row.delayed} icon="clock" caption="Worked past the duration" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_35rem] gap-6">
          <Panel boxed title="Tasks">
            <TaskTable
              tasks={tasks}
              hrefFor={vaTaskHref}
              delayed={delayedIds(tasks, sessions, now)}
              sessions={sessions}
              showVa={false}
              now={now}
              empty={<EmptyState compact headingLevel={3} title="No tasks yet" description={`When ${row.contact} adds a task for you, it shows up here.`} />}
            />
          </Panel>

          <Panel boxed title="Recent work sessions">
            {recent.length === 0 ? (
              <p className="m-0 type-body-sm text-ink-muted">No time recorded for this client yet.</p>
            ) : (
              <ol className="m-0 grid list-none gap-1.5 p-0">
                {recent.map((session) => {
                  const start = new Date(session.startedAt);
                  const end = session.endedAt ? new Date(session.endedAt) : null;
                  return (
                    <li key={session.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 rounded-md bg-surface-sunken px-3.5 py-2.5">
                      <span className="truncate type-body-sm font-semibold text-ink">{titleOf.get(session.taskId) ?? "Task"}</span>
                      <span className="type-body-sm font-semibold text-ink tabular-nums">{end ? formatMs(end.getTime() - start.getTime()) : "Running"}</span>
                      <span className="type-caption text-ink-muted">
                        {day.format(start)}, {clock.format(start)}–{end ? clock.format(end) : "now"} · your time
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <aside aria-label="About this client" className="grid min-w-0 flex-[1_1_18rem] gap-6 lg:max-w-[23.75rem]">
          <Panel boxed title="Their time">
            {row.time ? (
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className={row.time.day ? "grid size-12 place-items-center rounded-pill bg-shift-day-bg text-shift-day-ink" : "grid size-12 place-items-center rounded-pill bg-shift-night-bg text-shift-night-ink"}
                >
                  <Icon name={row.time.day ? "sun" : "moon"} size={24} />
                </span>
                <span className="grid gap-0.5">
                  <span className="type-stat text-ink">{row.time.clock}</span>
                  <span className="type-body-sm text-ink-muted">
                    {row.time.city} · {row.time.line.split(" · ")[1]}
                  </span>
                </span>
              </div>
            ) : (
              <div className="grid justify-items-start gap-1.5">
                <Badge tone="warning" size="sm">
                  Time zone not set
                </Badge>
                <p className="m-0 type-body-sm text-ink-muted">Ask your admin to add it to the client&apos;s record.</p>
              </div>
            )}
          </Panel>

          <Panel boxed title="Contact">
            <dl className="m-0 grid gap-3">
              <div className="grid gap-0.5">
                <dt className="type-caption font-semibold text-ink-muted">Contact</dt>
                <dd className="m-0 type-body text-ink">{row.contact}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="type-caption font-semibold text-ink-muted">Email</dt>
                <dd className="m-0 type-body break-all">
                  <a href={`mailto:${row.email}`}>{row.email}</a>
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="type-caption font-semibold text-ink-muted">Client since</dt>
                <dd className="m-0 type-body text-ink">{row.since}</dd>
              </div>
            </dl>
          </Panel>

          <Panel boxed title="Package">
            <dl className="m-0 grid gap-0.5">
              <dt className="type-caption font-semibold text-ink-muted">Hours a week</dt>
              <dd className="m-0 type-body text-ink">{row.hours ? `${row.hours.agreed} h` : "Not agreed yet"}</dd>
            </dl>
          </Panel>
        </aside>
      </div>
    </Workspace>
  );
}
