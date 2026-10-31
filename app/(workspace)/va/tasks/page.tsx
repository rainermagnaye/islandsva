import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { ClientSearch } from "@/features/clients/components/client-search";
import { TaskMetrics } from "@/features/tasks/components/task-metrics";
import { TimerButton } from "@/features/tasks/components/task-moves";
import { TaskTable } from "@/features/tasks/components/task-table";
import { listTasks, listWorkSessions } from "@/features/tasks/dal";
import { delayedIds, formatMinutes, formatMs, runningSession, workedMs } from "@/features/tasks/time";
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

  // RLS keeps both to the VA's own tasks and sessions.
  const tasks = await listTasks();
  const sessions = await listWorkSessions(tasks.map((task) => task.id));
  const now = new Date();
  const delayed = delayedIds(tasks, sessions, now);
  const shown = filterTasks(tasks, query, filter, delayed, now);
  const openDelayed = tasks.filter((task) => task.status !== "done" && delayed.has(task.id)).length;

  // At most one clock runs per VA (the database enforces it): show it on top so it's never forgotten.
  const runningTask = tasks.find((task) => runningSession(sessions.get(task.id) ?? []) !== null);
  const runningSessions = runningTask ? (sessions.get(runningTask.id) ?? []) : [];
  const current = runningSession(runningSessions);

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
      {runningTask && current && (
        <Alert
          tone="info"
          title={`Timer running · ${runningTask.title}`}
          action={
            <>
              <TimerButton taskId={runningTask.id} timer="pause" />
              <Button href={vaTaskHref(runningTask.id)} variant="ghost">
                Open task
              </Button>
            </>
          }
        >
          <p className="m-0">
            {runningTask.companyName} · this session {formatMs(now.getTime() - Date.parse(current.startedAt))} · {formatMs(workedMs(runningSessions, now))} of{" "}
            {formatMinutes(runningTask.durationMinutes)} used. Pause it before you switch to another task.
          </p>
        </Alert>
      )}
      <TaskMetrics tasks={tasks} href={appRoutes.vaTasks} delayed={openDelayed} now={now} />
      <TaskTable
        tasks={shown}
        hrefFor={vaTaskHref}
        delayed={delayed}
        sessions={sessions}
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
