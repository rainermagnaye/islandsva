import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task, type WorkSession } from "../contract";
import { isOverdue } from "../metrics";
import { formatMinutes, formatMs, runningSession, workedMs } from "../time";

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

type Options = { delayed: ReadonlySet<string>; sessions?: ReadonlyMap<string, readonly WorkSession[]>; showVa: boolean };

/** "Not started · 1 h", or "54 min of 1 h" with a clock while it runs. */
function timeCell(task: Task, sessions: readonly WorkSession[], delayed: boolean, now: Date) {
  const running = runningSession(sessions) !== null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {running && <Icon name="clock" size={16} label="Timer running" className="text-action-secondary" />}
      <span className="whitespace-nowrap tabular-nums">
        {sessions.length === 0 ? `Not started · ${formatMinutes(task.durationMinutes)}` : `${formatMs(workedMs(sessions, now))} of ${formatMinutes(task.durationMinutes)}`}
      </span>
      {delayed && (
        <Badge tone="warning" size="sm">
          Delayed
        </Badge>
      )}
    </span>
  );
}

const columns = (hrefFor: (id: string) => string, now: Date, { delayed, sessions, showVa }: Options): Column<Task>[] => [
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
  ...(showVa ? [{ key: "va", label: "VA", render: (task: Task) => clipped(task.vaFirstName) }] : []),
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
  ...(sessions
    ? [{ key: "time", label: "Time", nowrap: true, render: (task: Task) => timeCell(task, sessions.get(task.id) ?? [], delayed.has(task.id), now) }]
    : []),
  {
    key: "status",
    label: "Status",
    nowrap: true,
    render: (task) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge tone={TASK_STATUS_TONES[task.status]} size="sm">
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
        {!sessions && delayed.has(task.id) && (
          <Badge tone="warning" size="sm">
            Delayed
          </Badge>
        )}
      </span>
    ),
  },
];

const NONE: ReadonlySet<string> = new Set();

/**
 * Task list. The title opens the task. Selection stays off: these rows are not a bulk action. `delayed` holds the
 * ids of tasks whose work time ran past their duration. With `sessions`, a Time column shows the work against the
 * duration (and Delayed moves there). `showVa` is off on the VA's own list, where every row is theirs.
 */
export function TaskTable({
  tasks,
  hrefFor,
  empty,
  delayed = NONE,
  sessions,
  showVa = true,
  now = new Date(),
}: {
  tasks: readonly Task[];
  hrefFor: (id: string) => string;
  empty: ReactNode;
  delayed?: ReadonlySet<string>;
  sessions?: ReadonlyMap<string, readonly WorkSession[]>;
  showVa?: boolean;
  now?: Date;
}) {
  return (
    <DataTable caption="Tasks" columns={columns(hrefFor, now, { delayed, sessions, showVa })} rows={tasks} rowKey={(task) => task.id} rowLabel={(task) => task.title} selectable={false} empty={empty} />
  );
}
