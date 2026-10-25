"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { cardSurface } from "./card";
import { Icon } from "./icon";
import type { Tone } from "./tone";

export type TaskItem = { id: string; title: string; assignee?: string; tone?: Tone; due?: string; overdue?: boolean; priority?: "high" | "medium" | "low"; done?: boolean };

const PRIORITY = { high: { label: "High", tone: "danger" }, medium: { label: "Medium", tone: "warning" }, low: { label: "Low", tone: "neutral" } } as const;

/** Open tasks first, then by due date (ISO dates compare as text; undated last); done tasks keep their order at the end. */
export function sortTasks(tasks: readonly TaskItem[]) {
  const due = (task: TaskItem) => task.due ?? "9999-12-31";
  return [...tasks].sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || (a.done ? 0 : due(a) < due(b) ? -1 : due(a) > due(b) ? 1 : 0));
}

/**
 * The client's and VA's shared to-do panel. Each row is a real checkbox labelled by the task title; persist
 * onToggle with a Server Action. Show at most ~8 rows on a dashboard and link to the full list.
 */
export function TaskList({ tasks, title = "Tasks", onToggle, action, className }: { tasks: readonly TaskItem[]; title?: string; onToggle?: (id: string, done: boolean) => void; action?: ReactNode; className?: string }) {
  const open = tasks.filter((task) => !task.done).length;
  return (
    <section aria-label={title} className={cx(cardSurface, "grid gap-3 p-5", className)}>
      <div className="flex items-center gap-3">
        <h2 className="m-0 flex-1 type-h4 text-ink">
          {title} <span className="type-body-sm text-ink-muted">({open} open)</span>
        </h2>
        {action}
      </div>
      <ul className="m-0 grid list-none gap-1 p-0">
        {sortTasks(tasks).map((task) => (
          <li key={task.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-action-ghost-hover">
            <input
              id={`task-${task.id}`}
              type="checkbox"
              checked={Boolean(task.done)}
              onChange={(event) => onToggle?.(task.id, event.target.checked)}
              className="size-5 shrink-0 accent-[var(--color-action-secondary)]"
            />
            <label htmlFor={`task-${task.id}`} className={cx("min-w-0 flex-1 cursor-pointer type-body-sm", task.done ? "text-ink-muted line-through" : "text-ink")}>
              {task.title}
            </label>
            {!task.done && task.priority && (
              <Badge tone={PRIORITY[task.priority].tone} size="sm" dot>
                {PRIORITY[task.priority].label}
              </Badge>
            )}
            {task.due && (
              <span className={cx("inline-flex items-center gap-1 type-caption whitespace-nowrap", task.overdue && !task.done ? "text-status-danger" : "text-ink-muted")}>
                {task.overdue && !task.done && <Icon name="alert-triangle" size={14} />}
                {task.overdue && !task.done ? `Overdue · ${task.due}` : task.due}
              </span>
            )}
            {task.assignee && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={task.assignee} tone={task.tone} size="sm" />
                <span className="sr-only">Assigned to {task.assignee}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
