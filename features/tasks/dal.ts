import "server-only";
import { decodeBytea } from "@/lib/bytea";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { OwnCompany, Task, TaskComment, TaskEvent, TaskSeverity, TaskStatus, WorkSession } from "./contract";
import { sortTasks, type TaskMetric } from "./metrics";

// Reads and writes run as the signed-in user, so RLS checks again. No secret key: snapshots are filled by
// triggers, and IVA22–IVA25 and the timer's IVA39–IVA40 are mapped here (not in a shared code table).

const TASK_COLUMNS =
  "id, client_id, va_id, title, description, severity, duration_minutes, deadline, deadline_time, deadline_timezone, company_name, va_first_name, status, done_at, started_at, created_by, created_at, updated_at";

const LIST_CAP = 500;

type TaskRow = {
  id: string;
  client_id: string;
  va_id: string;
  title: string;
  description: string | null;
  severity: TaskSeverity;
  duration_minutes: number;
  deadline: string;
  deadline_time: string | null;
  deadline_timezone: string;
  company_name: string;
  va_first_name: string;
  status: TaskStatus;
  done_at: string | null;
  started_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TaskWrite =
  | { ok: true; id: string }
  | { ok: false; field: "deadline" | "deadlineTime" | "vaId" }
  | { ok: false; form: "company" | "assignment" | "not_allowed" | "attachments" | "timer_running" | "timer_stopped" | "has_time" }
  | { ok: false; missing: true };

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    clientId: row.client_id,
    vaId: row.va_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    durationMinutes: row.duration_minutes,
    deadline: row.deadline,
    deadlineTime: row.deadline_time ? row.deadline_time.slice(0, 5) : null,
    deadlineTimezone: row.deadline_timezone,
    companyName: row.company_name,
    vaFirstName: row.va_first_name,
    status: row.status,
    doneAt: row.done_at,
    startedAt: row.started_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** IVA22–IVA25 from the task triggers. Anything else is an outage for the caller to log by code. */
function refusal(code: string | undefined): Exclude<TaskWrite, { ok: true }> | null {
  switch (code) {
    case "IVA22":
      return { ok: false, field: "deadline" };
    case "IVA23":
      return { ok: false, form: "company" };
    case "IVA24":
      return { ok: false, form: "assignment" };
    case "IVA39":
      return { ok: false, form: "timer_running" };
    case "IVA40":
      return { ok: false, form: "timer_stopped" };
    case "IVA25":
    case "IVA36":
    case "42501":
      return { ok: false, form: "not_allowed" };
    default:
      return null;
  }
}

/** The signed-in client's company, or null when they have none. A bad id does not hit the database. */
export async function getOwnCompany(userId: string): Promise<OwnCompany | null> {
  if (!isUuid(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, company_name, status, disabled_at, timezone").eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the client's company failed (${error.code})`);
  if (!data) return null;
  return {
    id: data.id,
    companyName: data.company_name,
    status: data.status,
    disabledAt: data.disabled_at,
    timezone: data.timezone,
  };
}

/** VA ids on the active assignment for this company. The caller must already be allowed to read it. */
export type ActiveVa = { id: string; firstName: string };

export async function listActiveVas(clientId: string): Promise<ActiveVa[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_va_assignments").select("va_id, va_first_name").eq("client_id", clientId).eq("status", "active");
  if (error) throw new UpstreamError("supabase", `Reading assignments for ${clientId} failed (${error.code})`);
  return data.map((row) => ({ id: row.va_id, firstName: row.va_first_name }));
}

/** Open tasks first (soonest deadline), then done, at most 500. RLS limits the rows to the caller. */
export async function listTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const open = await selectTasks(supabase, "open", LIST_CAP);
  const room = LIST_CAP - open.length;
  const done = room > 0 ? await selectTasks(supabase, "done", room) : [];
  return sortTasks([...open, ...done]);
}

async function selectTasks(supabase: Awaited<ReturnType<typeof createClient>>, kind: "open" | "done", limit: number): Promise<Task[]> {
  let query = supabase.from("tasks").select(TASK_COLUMNS).order("deadline", { ascending: true }).limit(limit);
  query = kind === "done" ? query.eq("status", "done") : query.neq("status", "done");
  const { data, error } = await query;
  if (error) throw new UpstreamError("supabase", `Listing tasks failed (${error.code})`);
  return data.map((row) => toTask(row));
}

const OVERVIEW_PAGE = 1000;
const OVERVIEW_PAGES = 20;

/**
 * Every task the caller can see, with only the columns on-time and overdue need.
 * Not `listTasks()`: that stops at 500 and fills with open tasks first, so a tenant total would be wrong.
 */
export async function listTaskMetrics(): Promise<TaskMetric[]> {
  const rows: TaskMetric[] = [];
  for (let page = 0; page < OVERVIEW_PAGES; page += 1) {
    const from = page * OVERVIEW_PAGE;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id, va_id, status, deadline, deadline_time, deadline_timezone, done_at")
      .order("id")
      .range(from, from + OVERVIEW_PAGE - 1);
    if (error) throw new UpstreamError("supabase", `Reading task figures failed (${error.code})`);
    rows.push(
      ...data.map((row) => ({
        id: row.id,
        vaId: row.va_id,
        status: row.status,
        deadline: row.deadline,
        deadlineTime: row.deadline_time ? row.deadline_time.slice(0, 5) : null,
        deadlineTimezone: row.deadline_timezone,
        doneAt: row.done_at,
      })),
    );
    if (data.length < OVERVIEW_PAGE) return rows;
  }
  throw new UpstreamError("supabase", "Reading task figures exceeded 20 pages");
}

/** Null when the id is not a uuid, the task is missing, or the caller cannot see it. */
export async function getTask(id: string): Promise<Task | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading task ${id} failed (${error.code})`);
  return data ? toTask(data) : null;
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  if (!isUuid(taskId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, author_id, author_first_name, body, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new UpstreamError("supabase", `Reading comments for ${taskId} failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorFirstName: row.author_first_name,
    body: row.body,
    createdAt: row.created_at,
  }));
}

/** The task's moves, oldest first. RLS shows them to whoever can read the task. */
export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  if (!isUuid(taskId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_events")
    .select("id, kind, note, actor_id, actor_first_name, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new UpstreamError("supabase", `Reading activity for ${taskId} failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    note: row.note,
    actorId: row.actor_id,
    actorFirstName: row.actor_first_name,
    createdAt: row.created_at,
  }));
}

export async function insertTask(input: {
  clientId: string;
  vaId: string;
  title: string;
  description: string | null;
  severity: TaskSeverity;
  durationMinutes: number;
  deadline: string;
  deadlineTime: string;
  createdBy: string;
}): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: input.clientId,
      va_id: input.vaId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      duration_minutes: input.durationMinutes,
      deadline: input.deadline,
      deadline_time: input.deadlineTime,
      created_by: input.createdBy,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Creating a task failed (${error.code})`);
  }
  if (!data) return { ok: false, form: "not_allowed" };
  return { ok: true, id: data.id };
}

export async function updateTask(
  taskId: string,
  input: { title: string; description: string | null; severity: TaskSeverity; durationMinutes: number; deadline: string; deadlineTime: string },
): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      severity: input.severity,
      duration_minutes: input.durationMinutes,
      deadline: input.deadline,
      deadline_time: input.deadlineTime,
    })
    .eq("id", taskId)
    .select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Updating task ${taskId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: taskId };
}

/**
 * One status move. `note` travels in transition_note: guard_task checks who may make the move, writes the
 * task_events row with the note and clears the column, all in this one update.
 */
export async function setTaskStatus(taskId: string, status: TaskStatus, note: string | null = null): Promise<TaskWrite> {
  if (!isUuid(taskId)) return { ok: false, missing: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status, transition_note: note }).eq("id", taskId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Updating task ${taskId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: taskId };
}

/** The file bytes are the caller's own upload, written as that user so RLS checks the task again. */
export async function insertTaskAttachment(input: { taskId: string; name: string; contentType: string; bytes: Uint8Array }): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: input.taskId,
      name: input.name,
      content_type: input.contentType,
      bytes: `\\x${Buffer.from(input.bytes).toString("hex")}`,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Attaching a file to task ${input.taskId} failed (${error.code})`);
  }
  if (!data) return { ok: false, form: "not_allowed" };
  return { ok: true, id: data.id };
}

export async function listTaskAttachments(taskId: string): Promise<{ id: string; name: string; type: string }[]> {
  if (!isUuid(taskId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_attachments").select("id, name, content_type").eq("task_id", taskId).order("created_at");
  if (error) throw new UpstreamError("supabase", `Listing attachments for task ${taskId} failed (${error.code})`);
  return data.map((row) => ({ id: row.id, name: row.name, type: row.content_type }));
}

/** One file on a task the caller can already read. */
export async function getTaskAttachment(taskId: string, attachmentId: string): Promise<{ name: string; type: string; bytes: Uint8Array } | null> {
  if (!isUuid(taskId) || !isUuid(attachmentId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_attachments").select("name, content_type, bytes").eq("id", attachmentId).eq("task_id", taskId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading an attachment on task ${taskId} failed (${error.code})`);
  if (!data) return null;
  return { name: data.name, type: data.content_type, bytes: decodeBytea(data.bytes) };
}

/** Removes the task after its files, comments and activity, as the signed-in client. */
export async function deleteTask(taskId: string): Promise<TaskWrite> {
  if (!isUuid(taskId)) return { ok: false, missing: true };
  const supabase = await createClient();
  // Recorded time counts against the package, so the database keeps it and refuses the delete (23001, restrict_violation). Checked
  // first, so the files, comments and activity aren't removed before that refusal.
  const time = await supabase.from("task_work_sessions").select("id").eq("task_id", taskId).limit(1);
  if (time.error) throw new UpstreamError("supabase", `Reading time on task ${taskId} failed (${time.error.code})`);
  if (time.data.length > 0) return { ok: false, form: "has_time" };
  const files = await supabase.from("task_attachments").delete().eq("task_id", taskId);
  if (files.error) {
    const refused = refusal(files.error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deleting attachments on task ${taskId} failed (${files.error.code})`);
  }
  const comments = await supabase.from("task_comments").delete().eq("task_id", taskId);
  if (comments.error) {
    const refused = refusal(comments.error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deleting comments on task ${taskId} failed (${comments.error.code})`);
  }
  const events = await supabase.from("task_events").delete().eq("task_id", taskId);
  if (events.error) {
    const refused = refusal(events.error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deleting activity on task ${taskId} failed (${events.error.code})`);
  }
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error) {
    if (error.code === "23001") return { ok: false, form: "has_time" };
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deleting task ${taskId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: taskId };
}

export async function insertTaskComment(taskId: string, authorId: string, body: string): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: authorId, body }).select("id").maybeSingle();
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Commenting on task ${taskId} failed (${error.code})`);
  }
  if (!data) return { ok: false, form: "not_allowed" };
  return { ok: true, id: data.id };
}

/** The signed-in author rewrites their own comment. */
export async function updateTaskComment(commentId: string, body: string): Promise<TaskWrite> {
  if (!isUuid(commentId)) return { ok: false, missing: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_comments").update({ body }).eq("id", commentId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Editing comment ${commentId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: commentId };
}

/** The signed-in author removes their own comment. */
export async function deleteTaskComment(commentId: string): Promise<TaskWrite> {
  if (!isUuid(commentId)) return { ok: false, missing: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_comments").delete().eq("id", commentId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Deleting comment ${commentId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: commentId };
}

// Work sessions --------------------------------------------------------------------------------------------------

type SessionRow = { id: string; task_id: string; started_at: string; ended_at: string | null };
const toSession = (row: SessionRow): WorkSession => ({ id: row.id, taskId: row.task_id, startedAt: row.started_at, endedAt: row.ended_at });

/** Task ids per request: keeps the `in` filter's URL short. */
const SESSION_CHUNK = 100;

/**
 * The VA's work sessions on these tasks, oldest first, grouped by task. RLS shows only sessions on tasks the
 * caller can read. `since` keeps sessions still running or ended at or after that instant (the package week).
 */
export async function listWorkSessions(taskIds: readonly string[], since?: string): Promise<Map<string, WorkSession[]>> {
  const ids = [...new Set(taskIds.filter(isUuid))];
  const byTask = new Map<string, WorkSession[]>();
  if (ids.length === 0) return byTask;
  const supabase = await createClient();
  const chunks = Array.from({ length: Math.ceil(ids.length / SESSION_CHUNK) }, (_, i) => ids.slice(i * SESSION_CHUNK, (i + 1) * SESSION_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) => {
      let query = supabase.from("task_work_sessions").select("id, task_id, started_at, ended_at").in("task_id", chunk).order("started_at", { ascending: true });
      if (since) query = query.or(`ended_at.is.null,ended_at.gte."${since}"`);
      return query;
    }),
  );
  for (const { data, error } of results) {
    if (error) throw new UpstreamError("supabase", `Listing work sessions failed (${error.code})`);
    for (const row of data) {
      const session = toSession(row);
      byTask.set(session.taskId, [...(byTask.get(session.taskId) ?? []), session]);
    }
  }
  return byTask;
}

/**
 * The VA starts or resumes their clock on a task (the first start also moves it to In progress). The database
 * function checks the caller, the task's status, the assignment and the one-timer-per-VA rule.
 */
export async function startTaskTimer(taskId: string): Promise<TaskWrite> {
  if (!isUuid(taskId)) return { ok: false, missing: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_task_timer", { task_id: taskId });
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Starting the timer on task ${taskId} failed (${error.code})`);
  }
  return { ok: true, id: taskId };
}

/** The VA pauses their running clock on a task. */
export async function pauseTaskTimer(taskId: string): Promise<TaskWrite> {
  if (!isUuid(taskId)) return { ok: false, missing: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_task_timer", { task_id: taskId });
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Pausing the timer on task ${taskId} failed (${error.code})`);
  }
  return { ok: true, id: taskId };
}
