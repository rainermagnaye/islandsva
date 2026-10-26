import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { OwnCompany, Task, TaskComment, TaskStatus } from "./contract";
import { sortTasks, type TaskMetric } from "./metrics";

// Reads and writes run as the signed-in user, so RLS checks again. No secret key: snapshots are filled by
// triggers, and IVA22–IVA25 are mapped here (not in a shared code table).

const TASK_COLUMNS =
  "id, client_id, va_id, title, deadline, deadline_timezone, company_name, va_first_name, status, done_at, created_by, created_at, updated_at";

const LIST_CAP = 500;

type TaskRow = {
  id: string;
  client_id: string;
  va_id: string;
  title: string;
  deadline: string;
  deadline_timezone: string;
  company_name: string;
  va_first_name: string;
  status: TaskStatus;
  done_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TaskWrite =
  | { ok: true; id: string }
  | { ok: false; field: "deadline" | "vaId" }
  | { ok: false; form: "company" | "assignment" | "not_allowed" }
  | { ok: false; missing: true };

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    clientId: row.client_id,
    vaId: row.va_id,
    title: row.title,
    deadline: row.deadline,
    deadlineTimezone: row.deadline_timezone,
    companyName: row.company_name,
    vaFirstName: row.va_first_name,
    status: row.status,
    doneAt: row.done_at,
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
    case "IVA25":
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
      .select("id, va_id, status, deadline, deadline_timezone, done_at")
      .order("id")
      .range(from, from + OVERVIEW_PAGE - 1);
    if (error) throw new UpstreamError("supabase", `Reading task figures failed (${error.code})`);
    rows.push(
      ...data.map((row) => ({
        id: row.id,
        vaId: row.va_id,
        status: row.status,
        deadline: row.deadline,
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

export async function insertTask(input: { clientId: string; vaId: string; title: string; deadline: string; createdBy: string }): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: input.clientId,
      va_id: input.vaId,
      title: input.title,
      deadline: input.deadline,
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

export async function updateTask(taskId: string, input: { title: string; deadline: string }): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ title: input.title, deadline: input.deadline }).eq("id", taskId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Updating task ${taskId} failed (${error.code})`);
  }
  if (data.length === 0) return { ok: false, missing: true };
  return { ok: true, id: taskId };
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<TaskWrite> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("id");
  if (error) {
    const refused = refusal(error.code);
    if (refused) return refused;
    throw new UpstreamError("supabase", `Updating task ${taskId} failed (${error.code})`);
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
