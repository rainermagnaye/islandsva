import "server-only";
import { convertWallClock } from "@/components/ui/date-math";
import { TASK_LIMITS, severityForMinutes, type TaskSeverity, type TaskStatus } from "./contract";
import { assignedClientZone, deleteBlock, insertBlock, listBlocks } from "./blocks-dal";
import {
  deleteTask as deleteTaskRow,
  deleteTaskComment,
  getOwnCompany,
  getTask,
  insertTask,
  insertTaskAttachment,
  insertTaskComment,
  listActiveVas,
  listTaskAttachments,
  listTasks,
  setTaskStatus,
  updateTask,
  updateTaskComment,
  type TaskWrite,
} from "./dal";
import { acceptableDeadline, taskTimeZone } from "./metrics";
import type { VaTaskInput } from "./validation";

export type { TaskWrite };

// The caller (a Server Action) has already checked the role. These functions only resolve the assignment
// and write. They read assignments as the signed-in user and do not use another feature's data access.

export async function createTask(
  actorId: string,
  input: { title: string; description?: string; severity?: TaskSeverity; deadline: string; deadlineTime: string; vaId?: string; vaIds?: readonly string[] },
  files: readonly { name: string; contentType: string; bytes: Uint8Array }[] = [],
): Promise<TaskWrite> {
  const company = await getOwnCompany(actorId);
  if (!company) return { ok: false, form: "assignment" };
  const when = acceptableDeadline(input.deadline, input.deadlineTime, taskTimeZone(company.timezone));
  if (when === "date") return { ok: false, field: "deadline" };
  if (when === "time") return { ok: false, field: "deadlineTime" };
  const vas = await listActiveVas(company.id);
  if (vas.length === 0) return { ok: false, form: "assignment" };
  const requested = input.vaIds && input.vaIds.length > 0 ? input.vaIds : input.vaId ? [input.vaId] : [];
  if (requested.length === 0 || requested.some((vaId) => !vas.some((va) => va.id === vaId))) return { ok: false, field: "vaId" };
  const severity = input.severity ?? "medium";
  let first = "";
  for (const vaId of requested) {
    const created = await insertTask({
      clientId: company.id,
      vaId,
      title: input.title,
      description: input.description || null,
      severity,
      deadline: input.deadline,
      deadlineTime: input.deadlineTime,
      createdBy: actorId,
    });
    if (!created.ok) return created;
    if (!first) first = created.id;
    for (const file of files) {
      const attached = await insertTaskAttachment({ taskId: created.id, name: file.name, contentType: file.contentType, bytes: file.bytes });
      if (!attached.ok) return attached;
    }
  }
  return { ok: true, id: first };
}

export async function editTask(
  actorId: string,
  input: { taskId: string; title: string; description?: string; severity?: TaskSeverity; deadline: string; deadlineTime: string },
): Promise<TaskWrite> {
  const company = await getOwnCompany(actorId);
  if (!company) return { ok: false, missing: true };
  const existing = await getTask(input.taskId);
  if (!existing) return { ok: false, missing: true };
  const when = acceptableDeadline(input.deadline, input.deadlineTime, existing.deadlineTimezone);
  if (when === "date") return { ok: false, field: "deadline" };
  if (when === "time") return { ok: false, field: "deadlineTime" };
  return updateTask(input.taskId, {
    title: input.title,
    description: input.description || null,
    // A form without it keeps what the task has.
    severity: input.severity ?? existing.severity,
    deadline: input.deadline,
    deadlineTime: input.deadlineTime,
  });
}

export async function removeTask(taskId: string): Promise<TaskWrite> {
  return deleteTaskRow(taskId);
}

/** A move with no note: the VA starts, the client approves or closes. The database decides who may. */
export async function changeTaskStatus(input: { taskId: string; status: TaskStatus }): Promise<TaskWrite> {
  return setTaskStatus(input.taskId, input.status);
}

/** The VA hands the task over for review, with an optional note on what was done. */
export async function submitForReview(input: { taskId: string; note?: string }): Promise<TaskWrite> {
  return setTaskStatus(input.taskId, "review", input.note || null);
}

/**
 * The client sends the task back to the VA with feedback: from review that is "request changes", from
 * closed it is a reopen. Both land in In progress; the database records which one it was.
 */
export async function sendBack(input: { taskId: string; note: string }): Promise<TaskWrite> {
  return setTaskStatus(input.taskId, "in_progress", input.note);
}

/**
 * Files added after the task was created, up to the task's limit. The count is read first, so two uploads at
 * the same moment could pass it together; the 2 MB per-file cap still holds in the database.
 */
export async function attachFiles(taskId: string, files: readonly { name: string; contentType: string; bytes: Uint8Array }[]): Promise<TaskWrite> {
  const task = await getTask(taskId);
  if (!task) return { ok: false, missing: true };
  if (task.status === "done") return { ok: false, form: "not_allowed" };
  const existing = await listTaskAttachments(taskId);
  if (existing.length + files.length > TASK_LIMITS.attachments) return { ok: false, form: "attachments" };
  for (const file of files) {
    const attached = await insertTaskAttachment({ taskId, name: file.name, contentType: file.contentType, bytes: file.bytes });
    if (!attached.ok) return attached;
  }
  return { ok: true, id: taskId };
}

export async function addComment(actorId: string, input: { taskId: string; body: string }): Promise<TaskWrite> {
  return insertTaskComment(input.taskId, actorId, input.body);
}

export async function editComment(input: { commentId: string; body: string }): Promise<TaskWrite> {
  return updateTaskComment(input.commentId, input.body);
}

export async function removeComment(commentId: string): Promise<TaskWrite> {
  return deleteTaskComment(commentId);
}

/**
 * Tasks whose title contains the term, for the header search. RLS limits them to the caller's own (a client's
 * company, a VA's assignments). Filtered here because listTasks already holds at most 500 rows.
 */
export async function findTasks(term: string, limit: number) {
  const needle = term.toLocaleLowerCase();
  const tasks = await listTasks();
  return tasks.filter((task) => task.title.toLocaleLowerCase().includes(needle)).slice(0, limit);
}

export type VaBookingResult =
  | { ok: true; kind: "task" | "todo" | "block" }
  | { ok: false; field?: "clientId" | "taskId" | "date" | "startTime"; message: string };

const MANILA = "Asia/Manila";

/**
 * "Book › Task" from the VA calendar. With a client: a task for that client (the client reviews and closes it, as
 * with their own), due when the block ends in the client's zone, and a block for it. Without a client: a to-do
 * block of the VA's own. On an existing task: a block on it. The caller has already checked the VA role.
 */
export async function bookVaTask(vaId: string, input: VaTaskInput): Promise<VaBookingResult> {
  const startsAt = new Date(`${input.date}T${input.startTime}:00+08:00`);
  const endsAt = new Date(startsAt.getTime() + input.minutes * 60_000);
  if (endsAt.getTime() <= Date.now()) return { ok: false, field: "startTime", message: "Choose a time that's still ahead." };
  const span = { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };

  if (input.mode === "block") {
    const written = await insertBlock({ taskId: input.taskId, title: null, ...span });
    return written.ok ? { ok: true, kind: "block" } : { ok: false, field: "taskId", message: "Choose one of your open tasks." };
  }

  if (!input.clientId) {
    const written = await insertBlock({ taskId: null, title: input.title, ...span });
    return written.ok ? { ok: true, kind: "todo" } : { ok: false, message: "That time can't be blocked. Check the title and length." };
  }

  const client = await assignedClientZone(input.clientId);
  if (!client) return { ok: false, field: "clientId", message: "Choose one of your clients." };
  const zone = taskTimeZone(client.timezone);
  // The task is due when the block ends, as a wall clock in the client's zone (how their deadlines are kept).
  const due = convertWallClock(`${input.date}T${input.startTime}`, MANILA, zone);
  const end = new Date(Date.parse(`${due.date}T${due.time}:00Z`) + input.minutes * 60_000).toISOString();
  const deadline = end.slice(0, 10);
  const deadlineTime = end.slice(11, 16);
  if (acceptableDeadline(deadline, deadlineTime, zone) !== "ok") return { ok: false, field: "date", message: "Choose a day from today through the next year." };

  const created = await insertTask({
    clientId: input.clientId,
    vaId,
    title: input.title,
    description: input.description,
    severity: severityForMinutes(input.minutes),
    deadline,
    deadlineTime,
    createdBy: vaId,
  });
  if (!created.ok) {
    if ("form" in created && created.form === "assignment") return { ok: false, field: "clientId", message: "Choose a client you're assigned to." };
    if ("form" in created && created.form === "company") return { ok: false, field: "clientId", message: "That client's account isn't active." };
    if ("field" in created) return { ok: false, field: "date", message: "Choose a day from today through the next year." };
    return { ok: false, message: "That task can't be added right now." };
  }
  const block = await insertBlock({ taskId: created.id, title: null, ...span });
  // The task stands even if its block didn't save; the VA can block time on it again.
  return block.ok ? { ok: true, kind: "task" } : { ok: false, message: "The task was added, but its time couldn't be blocked. Use Block time on a task." };
}

/** The VA's blocks still ahead (and today's earlier ones), for the calendar. */
export function listVaBlocks(vaId: string, since: Date) {
  return listBlocks(vaId, since);
}

export function removeBlock(blockId: string) {
  return deleteBlock(blockId);
}
