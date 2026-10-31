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
import { listTasks } from "@/features/tasks/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { clientRows } from "../_components/client-rows";

// No company name in the title: page titles carry no client details (CLAUDE.md §6).
export const metadata: Metadata = { title: "Client" };

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
  const now = new Date();
  const [row] = clientRows([client], tasks, now);

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
      {/* Agreed hours only: hours worked come with timesheets (M14). */}
      <section aria-label="This week" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Agreed hours" value={row.hoursPerWeek} unit="h a week" icon="clock" caption={row.hoursPerWeek ? "From the package" : "No weekly hours agreed yet"} />
        <StatCard label="Open tasks" value={row.open} icon="check" />
        <StatCard label="Overdue" value={row.overdue} icon="alert-triangle" caption="Past the deadline" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_35rem] gap-6">
          <Panel boxed title="Tasks">
            <TaskTable
              tasks={tasks}
              hrefFor={vaTaskHref}
              showVa={false}
              now={now}
              empty={<EmptyState compact headingLevel={3} title="No tasks yet" description={`When ${row.contact} adds a task for you, it shows up here.`} />}
            />
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
              <dd className="m-0 type-body text-ink">{row.hoursPerWeek ? `${row.hoursPerWeek} h` : "Not agreed yet"}</dd>
            </dl>
          </Panel>
        </aside>
      </div>
    </Workspace>
  );
}
