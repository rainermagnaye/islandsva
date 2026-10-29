import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { clockLabel, minutesOf, zoneCity } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { TagChip } from "@/components/ui/tag-chip";
import type { Tone } from "@/components/ui/tone";
import { appRoutes, vaTaskHref } from "@/content/routes";
import { TASK_SEVERITY_LABELS, type Task, type TaskSeverity } from "@/features/tasks/contract";
import { isOverdue, relativeDay } from "@/features/tasks/metrics";

const SEVERITY_TONES: Record<TaskSeverity, BadgeTone> = { high: "warning", medium: "info", low: "neutral" };

/** "Today, 3 pm New York", "Today", or "Was due yesterday" — the deadline in the task's own zone. */
function dueLine(task: Task, now: Date) {
  if (isOverdue(task, now)) {
    const day = relativeDay(task.deadline, task.deadlineTimezone, now);
    return day === "Today" ? `Was due ${clockLabel(minutesOf(task.deadlineTime ?? "23:59"))} ${zoneCity(task.deadlineTimezone)}` : `Was due ${day.toLowerCase()}`;
  }
  return task.deadlineTime ? `Today, ${clockLabel(minutesOf(task.deadlineTime))} ${zoneCity(task.deadlineTimezone)}` : "Today";
}

/**
 * The VA's work for today: overdue first, then today's deadlines. Rows link to the task page, where the status
 * moves and the timer live — the dashboard itself changes nothing, so it ships no client code.
 */
export function TodayTasks({
  tasks,
  total,
  delayed,
  tones,
  now,
}: {
  tasks: readonly Task[];
  /** All of today's tasks, when `tasks` is cut short. */
  total: number;
  delayed: ReadonlySet<string>;
  tones: ReadonlyMap<string, Tone>;
  now: Date;
}) {
  return (
    <Panel
      boxed
      className="content-start"
      title="Today's tasks"
      action={
        <Link href={appRoutes.vaTasks} className="type-label">
          {total > tasks.length ? `All ${total} tasks` : "All tasks"}
        </Link>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState compact headingLevel={3} title="Nothing due today" description="Overdue tasks and today's deadlines show here." />
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0">
          {tasks.map((task) => {
            const late = isOverdue(task, now);
            return (
              <li key={task.id} className="grid gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0">
                <Link href={vaTaskHref(task.id)} className="type-label text-ink">
                  {task.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <TagChip size="sm" tone={tones.get(task.clientId) ?? "lagoon"}>
                    {task.companyName}
                  </TagChip>
                  <span className="type-body-sm text-ink-muted">{dueLine(task, now)}</span>
                  {late && (
                    <Badge tone="danger" size="sm">
                      Overdue
                    </Badge>
                  )}
                  {delayed.has(task.id) && (
                    <Badge tone="warning" size="sm">
                      Delayed
                    </Badge>
                  )}
                  <Badge tone={SEVERITY_TONES[task.severity]} size="sm" icon={null}>
                    {TASK_SEVERITY_LABELS[task.severity]}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
