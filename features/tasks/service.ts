import "server-only";
import type { TaskStatus } from "./contract";
import { getOwnCompany, insertTask, insertTaskComment, listActiveVas, setTaskStatus, updateTask, type TaskWrite } from "./dal";

export type { TaskWrite };

// The caller (a Server Action) has already checked the role. These functions only resolve the assignment
// and write. They read assignments as the signed-in user and do not use another feature's data access.

export async function createTask(actorId: string, input: { title: string; deadline: string; vaId?: string }): Promise<TaskWrite> {
  const company = await getOwnCompany(actorId);
  if (!company) return { ok: false, form: "assignment" };
  const vas = await listActiveVas(company.id);
  if (vas.length === 0) return { ok: false, form: "assignment" };
  const vaId = vas.length === 1 ? vas[0].id : input.vaId;
  if (vas.length > 1 && (!vaId || !vas.some((va) => va.id === vaId))) return { ok: false, field: "vaId" };
  if (!vaId) return { ok: false, form: "assignment" };
  return insertTask({ clientId: company.id, vaId, title: input.title, deadline: input.deadline, createdBy: actorId });
}

export async function editTask(actorId: string, input: { taskId: string; title: string; deadline: string }): Promise<TaskWrite> {
  const company = await getOwnCompany(actorId);
  if (!company) return { ok: false, missing: true };
  return updateTask(input.taskId, { title: input.title, deadline: input.deadline });
}

export async function changeTaskStatus(input: { taskId: string; status: TaskStatus }): Promise<TaskWrite> {
  return setTaskStatus(input.taskId, input.status);
}

export async function addComment(actorId: string, input: { taskId: string; body: string }): Promise<TaskWrite> {
  return insertTaskComment(input.taskId, actorId, input.body);
}
