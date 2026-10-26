import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/components/ui/date-math";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "../contract";
import { isOverdue } from "../metrics";

const TONE: Record<TaskStatus, "neutral" | "info" | "success"> = {
  todo: "neutral",
  in_progress: "info",
  done: "success",
};

function clipped(value: string) {
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}

const columns = (hrefFor: (id: string) => string, now: Date): Column<Task>[] => [
  {
    key: "title",
    label: "Task",
    render: (task) => (
      <Link href={hrefFor(task.id)} className="row-link" title={task.title}>
        {task.title}
      </Link>
    ),
  },
  { key: "company", label: "Company", render: (task) => clipped(task.companyName) },
  { key: "va", label: "VA", render: (task) => clipped(task.vaFirstName) },
  {
    key: "deadline",
    label: "Deadline",
    nowrap: true,
    render: (task) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">{formatDate(task.deadline, { dateStyle: "medium" })}</span>
        {isOverdue(task, now) && (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        )}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    nowrap: true,
    render: (task) => (
      <Badge tone={TONE[task.status]} size="sm">
        {TASK_STATUS_LABELS[task.status]}
      </Badge>
    ),
  },
];

/** Task list. The title opens the task. Selection stays off: these rows are not a bulk action. */
export function TaskTable({ tasks, hrefFor, empty, now = new Date() }: { tasks: readonly Task[]; hrefFor: (id: string) => string; empty: ReactNode; now?: Date }) {
  return (
    <DataTable caption="Tasks" columns={columns(hrefFor, now)} rows={tasks} rowKey={(task) => task.id} rowLabel={(task) => task.title} selectable={false} empty={empty} />
  );
}

/** The task's own title and company, under the page heading "Task". */
export function TaskSummary({ task, now = new Date() }: { task: Task; now?: Date }) {
  const overdue = isOverdue(task, now);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 type-h3">{task.title}</h2>
        <Badge tone={TONE[task.status]} size="sm">
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
        {overdue && (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        )}
      </div>
      <p className="m-0 type-body-sm text-ink-muted">
        {task.companyName} · {task.vaFirstName} · Due {formatDate(task.deadline, { dateStyle: "long" })}
      </p>
    </div>
  );
}
