import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { ClientAssignmentEnd } from "./client-assignment-end";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task } from "@/features/tasks/contract";
import { isOverdue } from "@/features/tasks/metrics";
import { packageBalanceLabel } from "../assistants";

const started = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function dueLabel(task: Pick<Task, "deadline" | "deadlineTime">) {
  const day = formatDate(task.deadline, { dateStyle: "medium" });
  return task.deadlineTime ? `${day}, ${clockLabel(minutesOf(task.deadlineTime))}` : day;
}

const columns = (now: Date): Column<Task>[] => [
  { key: "title", label: "Task", render: (task) => <span title={task.title}>{task.title}</span> },
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
  {
    key: "due",
    label: "Due",
    nowrap: true,
    render: (task) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">{dueLabel(task)}</span>
        {isOverdue(task, now) && (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        )}
      </span>
    ),
  },
];

/** One assigned VA on this client: who they are, this client's package, and their tasks here. Titles are not links — admin has no task page yet. */
export function AdminClientVa({
  name,
  email,
  photoSrc,
  assignmentId,
  startedAt,
  hoursPerWeek,
  packageName,
  tasks,
}: {
  name: string;
  email: string | null;
  photoSrc: string | undefined;
  assignmentId: string;
  startedAt: string;
  hoursPerWeek: number | null;
  packageName: string | null;
  tasks: readonly Task[];
}) {
  const now = new Date();

  return (
    <div className="grid gap-4">
      <Card as="section" aria-label={name} className="flex flex-wrap items-center gap-5">
        <Avatar name={name} src={photoSrc} size="lg" />
        <div className="grid min-w-0 flex-[1_1_18rem] gap-1">
          <h1 className="m-0 type-h1">{name}</h1>
          <p className="m-0 type-body-sm text-ink-muted">{[email, `Assigned ${started.format(new Date(startedAt))}`].filter(Boolean).join(" · ")}</p>
        </div>
        <ClientAssignmentEnd assignmentId={assignmentId} />
      </Card>

      <section aria-label="Package" className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Package balance" value={hoursPerWeek} unit={hoursPerWeek ? "hrs / week" : undefined} icon="clock" caption="Hours worked aren't recorded yet" />
        <Card as="section" padding="sm" aria-labelledby="package-title" className="grid gap-3">
          <h2 id="package-title" className="m-0 type-label">
            Package for this client
          </h2>
          <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 type-body-sm">
            <dt className="font-semibold text-ink-muted">Package</dt>
            <dd className="m-0">{packageName ?? "Once it's confirmed"}</dd>
            <dt className="font-semibold text-ink-muted">Weekly hours</dt>
            <dd className="m-0">{packageBalanceLabel(hoursPerWeek)}</dd>
          </dl>
        </Card>
      </section>

      <DataTable
        caption="Tasks"
        columns={columns(now)}
        rows={tasks}
        rowKey={(task) => task.id}
        rowLabel={(task) => task.title}
        selectable={false}
        empty={<EmptyState compact headingLevel={3} title="No tasks yet" description="Tasks this VA has for this client show here." />}
      />
    </div>
  );
}
