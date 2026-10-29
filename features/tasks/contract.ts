// Shared task rules. No Zod here — validation.ts is the server-side check. Limits match the database checks.

export const TASK_LIMITS = { title: 160, description: 2000, comment: 2000, note: 2000, deadlineDays: 366, attachments: 3 } as const;

/** Used when the company has no time zone of its own, so a deadline can still be saved. */
export const TASK_FALLBACK_TIMEZONE = "Asia/Manila";

export const TASK_SEVERITIES = ["low", "medium", "high"] as const;
export type TaskSeverity = (typeof TASK_SEVERITIES)[number];

export const TASK_SEVERITY_LABELS: Record<TaskSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * How long a task should take, in minutes. The client picks it; the severity sets the starting value. The VA's
 * timer is measured against it (more time is "Delayed"). Matches the tasks_duration_range check.
 */
export const TASK_DURATION = {
  min: 5,
  max: 600,
  defaults: { low: 30, medium: 60, high: 120 } satisfies Record<TaskSeverity, number>,
} as const;

/** One stretch of the VA's work on a task. `endedAt` is null while the timer runs. Times are UTC ISO. */
export type WorkSession = { id: string; taskId: string; startedAt: string; endedAt: string | null };

/** In order. `done` is stored under that name and shown as Closed: the client approved it or closed it. */
export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  done: "Closed",
};

export const TASK_STATUS_TONES: Record<TaskStatus, "neutral" | "info" | "warning" | "success"> = {
  todo: "neutral",
  in_progress: "info",
  review: "warning",
  done: "success",
};

/** One status move, written by the database in the same statement as the move. */
export const TASK_EVENT_KINDS = ["started", "submitted", "changes_requested", "approved", "closed", "reopened"] as const;
export type TaskEventKind = (typeof TASK_EVENT_KINDS)[number];

export type TaskEvent = {
  id: string;
  kind: TaskEventKind;
  /** The VA's handover note or the client's feedback. */
  note: string | null;
  /** Null when the server made the move. */
  actorId: string | null;
  actorFirstName: string | null;
  createdAt: string;
};

export type TaskField = "title" | "description" | "severity" | "durationHours" | "durationMinutes" | "deadline" | "deadlineTime" | "vaId";
export type TaskStatusField = "status";
/** The handover note (VA) or the feedback (client) sent with a move. */
export type TaskNoteField = "note";
export type CommentField = "body";

/** A task as the client and the VA see it. Names and the deadline zone are snapshots. */
export type Task = {
  id: string;
  clientId: string;
  vaId: string;
  title: string;
  description: string | null;
  severity: TaskSeverity;
  /** How long the work should take, in minutes. */
  durationMinutes: number;
  deadline: string;
  /** "HH:MM" in `deadlineTimezone`. Null is the end of that day. */
  deadlineTime: string | null;
  deadlineTimezone: string;
  companyName: string;
  vaFirstName: string;
  status: TaskStatus;
  doneAt: string | null;
  startedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  authorFirstName: string;
  body: string;
  createdAt: string;
};

/** The signed-in client's company, used to decide whether the create and edit forms are shown. */
export type OwnCompany = {
  id: string;
  companyName: string;
  status: "pending" | "active" | "inactive";
  disabledAt: string | null;
  timezone: string | null;
};
