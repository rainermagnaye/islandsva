"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Tabs } from "@/components/ui/tabs";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type TaskStatus } from "../contract";

/** One task as the VA profile lists it. Dates are already formatted in the client's time zone. */
export type VaTaskRow = {
  id: string;
  href: string;
  title: string;
  status: TaskStatus;
  added: string;
  due: string;
  overdue: boolean;
  completed: string | null;
};

type TaskFilter = "open" | "done";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Still open" },
  { value: "done", label: "Completed" },
];


const columns: Column<VaTaskRow>[] = [
  {
    key: "title",
    label: "Task",
    render: (task) => (
      <Link href={task.href} className="row-link" title={task.title}>
        {task.title}
      </Link>
    ),
  },
  {
    key: "status",
    label: "Status",
    nowrap: true,
    render: (task) => (
      <Badge tone={TASK_STATUS_TONES[task.status]} size="sm">
        {TASK_STATUS_LABELS[task.status]}
      </Badge>
    ),
  },
  { key: "added", label: "Added", nowrap: true, render: (task) => task.added },
  {
    key: "due",
    label: "Due",
    nowrap: true,
    render: (task) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">{task.due}</span>
        {task.overdue && (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        )}
      </span>
    ),
  },
  { key: "completed", label: "Completed", nowrap: true, render: (task) => task.completed ?? <span className="text-ink-muted">—</span> },
];

const matches = (task: VaTaskRow, filter: TaskFilter | undefined) =>
  !filter || (filter === "done" ? task.status === "done" : task.status !== "done");

/**
 * A VA's profile below the header: Tasks (the standard table, with the Filter button on the tab row) and Plan
 * usage. Tabs are client state; the panels' content comes from the page.
 */
export function VaTaskTabs({ tasks, plan }: { tasks: readonly VaTaskRow[]; plan: ReactNode }) {
  const [tab, setTab] = useState("tasks");
  const [filter, setFilter] = useState<TaskFilter | undefined>();
  const shown = tasks.filter((task) => matches(task, filter));
  const open = tasks.filter((task) => task.status !== "done").length;
  const what = filter ? FILTERS.find((option) => option.value === filter)?.label : "All tasks";

  return (
    <Tabs
      label="Work"
      value={tab}
      onChange={setTab}
      action={tab === "tasks" ? <FilterMenu options={FILTERS} value={filter} onChange={setFilter} allLabel="All tasks" /> : undefined}
      tabs={[
        {
          id: "tasks",
          label: "Tasks",
          icon: "inbox",
          count: open,
          content: (
            <div className="grid gap-3">
              <p className="m-0 type-body-sm text-ink-muted" aria-live="polite">
                {what} · {shown.length === 1 ? "1 task" : `${shown.length} tasks`}
              </p>
              <DataTable
                caption="Tasks"
                columns={columns}
                rows={shown}
                rowKey={(task) => task.id}
                rowLabel={(task) => task.title}
                selectable={false}
                empty={
                  <EmptyState
                    compact
                    headingLevel={3}
                    title={filter === "done" ? "No completed tasks" : filter === "open" ? "No open tasks" : "No tasks yet"}
                    description={filter === "done" ? "Finished tasks show here." : "Add one with a deadline."}
                  />
                }
              />
            </div>
          ),
        },
        { id: "plan", label: "Plan usage", icon: "chart", content: plan },
      ]}
    />
  );
}
