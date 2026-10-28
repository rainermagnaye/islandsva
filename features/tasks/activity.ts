import type { Task, TaskEvent, TaskEventKind, TaskStatus } from "./contract";

// The task's activity, read from task_events. Pure, so the rules are tested without a database.

export type ActivityKind = "added" | TaskEventKind;

export type ActivityEntry = {
  key: string;
  kind: ActivityKind;
  /** Null when nobody is on record: a task closed before the activity existed. `id: null` is the server. */
  actor: { id: string | null; firstName: string | null } | null;
  at: string;
  note: string | null;
};

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  added: "Task added",
  started: "Started",
  submitted: "Submitted for review",
  changes_requested: "Changes requested",
  approved: "Approved and closed",
  closed: "Closed",
  reopened: "Reopened",
};

/**
 * Added first, then each move, oldest first. A task from before the activity existed has no events, so its
 * start and close come from the row (the VA started it; who closed it is not known here).
 */
export function taskActivity(
  task: Pick<Task, "createdAt" | "createdBy" | "startedAt" | "doneAt" | "vaId" | "vaFirstName">,
  events: readonly TaskEvent[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    { key: "added", kind: "added", actor: { id: task.createdBy, firstName: null }, at: task.createdAt, note: null },
    ...events.map((event) => ({
      key: event.id,
      kind: event.kind,
      actor: { id: event.actorId, firstName: event.actorFirstName },
      at: event.createdAt,
      note: event.note,
    })),
  ];
  if (task.startedAt && !events.some((event) => event.kind === "started")) {
    entries.push({ key: "started", kind: "started", actor: { id: task.vaId, firstName: task.vaFirstName }, at: task.startedAt, note: null });
  }
  if (task.doneAt && !events.some((event) => event.kind === "approved" || event.kind === "closed")) {
    entries.push({ key: "closed", kind: "closed", actor: null, at: task.doneAt, note: null });
  }
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => Date.parse(a.entry.at) - Date.parse(b.entry.at) || a.index - b.index)
    .map(({ entry }) => entry);
}

/** The stepper position: To do, In progress, Review, Closed. A closed task has every step done. */
export function progressStep(status: TaskStatus): number {
  return { todo: 0, in_progress: 1, review: 2, done: 4 }[status];
}

/** The feedback the VA is working from: the last move, when it sent the task back. */
export function openFeedback(status: TaskStatus, events: readonly TaskEvent[]): TaskEvent | null {
  if (status !== "in_progress" || events.length === 0) return null;
  const last = events.reduce((latest, event) => (Date.parse(event.createdAt) >= Date.parse(latest.createdAt) ? event : latest));
  return last.kind === "changes_requested" || last.kind === "reopened" ? last : null;
}

/** When the task last reached a step, for the stepper's captions. */
export function lastAt(events: readonly TaskEvent[], kinds: readonly TaskEventKind[]): string | null {
  const times = events.filter((event) => kinds.includes(event.kind)).map((event) => event.createdAt);
  return times.length === 0 ? null : times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}
