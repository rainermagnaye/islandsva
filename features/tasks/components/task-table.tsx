import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task } from "../contract";
import { isOverdue } from "../metrics";

function dueLabel(task: Pick<Task, "deadline" | "deadlineTime">, style: "medium" | "long") {
  const day = formatDate(task.deadline, { dateStyle: style });
  return task.deadlineTime ? `${day}, ${clockLabel(minutesOf(task.deadlineTime))}` : day;
}

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
        <span className="whitespace-nowrap">{dueLabel(task, "medium")}</span>
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
      <Badge tone={TASK_STATUS_TONES[task.status]} size="sm">
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
