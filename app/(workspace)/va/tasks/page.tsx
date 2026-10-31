import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { ClientSearch } from "@/features/clients/components/client-search";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { TaskTable } from "@/features/tasks/components/task-table";
import { listTasks } from "@/features/tasks/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { filterTasks, taskFilterOf } from "./_components/task-filter";
import { TasksFilter } from "./_components/tasks-filter";

export const metadata: Metadata = { title: "Tasks" };

const SEARCH_MAX = 100;

export default function VaTasksPage({ searchParams }: PageProps<"/va/tasks">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaTasks searchParams={searchParams} />
    </Suspense>
  );
}

async function VaTasks({ searchParams }: Pick<PageProps<"/va/tasks">, "searchParams">) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, SEARCH_MAX) : "";
  const filter = taskFilterOf(params.show);

  // RLS keeps these to the VA's own tasks.
  const tasks = await listTasks();
  const now = new Date();
  const shown = filterTasks(tasks, query, filter, now);

  return (
    <Workspace
      title="Tasks"
      actions={
        <>
          <ClientSearch path={appRoutes.vaTasks} label="Search tasks" />
          <TasksFilter value={filter} query={query} />
        </>
      }
    >
      <TaskMetrics tasks={tasks} href={appRoutes.vaTasks} now={now} />
      <TaskTable
        tasks={shown}
        hrefFor={vaTaskHref}
        showVa={false}
        now={now}
        empty={
          tasks.length === 0 ? (
            <EmptyState compact title="No tasks yet" description="When a client adds a task for you, it shows up here." />
          ) : (
            <EmptyState compact title="No tasks match" description="Try another search, or choose All Tasks in Filter." />
          )
        }
      />
    </Workspace>
  );
}
