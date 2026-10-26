// Shared task rules. No Zod here — validation.ts is the server-side check. Limits match the database checks.

export const TASK_LIMITS = { title: 160, comment: 2000, deadlineDays: 366 } as const;

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export type TaskField = "title" | "deadline" | "vaId";
export type TaskStatusField = "status";
export type CommentField = "body";

/** A task as the client and the VA see it. Names and the deadline zone are snapshots. */
export type Task = {
  id: string;
  clientId: string;
  vaId: string;
  title: string;
  deadline: string;
  deadlineTimezone: string;
  companyName: string;
  vaFirstName: string;
  status: TaskStatus;
  doneAt: string | null;
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
