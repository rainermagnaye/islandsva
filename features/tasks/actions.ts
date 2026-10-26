"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { clientTaskHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { FIELD_ERRORS, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { CommentField, TaskField, TaskStatusField } from "./contract";
import { addComment, changeTaskStatus, createTask as saveTask, editTask, type TaskWrite } from "./service";
import { parseComment, parseCreate, parseStatus, parseUpdate } from "./validation";

const MISSING = "That task no longer exists. Refresh the page.";

const FIELD_COPY = {
  deadline: "Choose a date from today through the next year.",
  vaId: "Choose the VA this task is for.",
} as const;

const FORM_COPY = {
  company: "That can be saved while your company is active.",
  assignment: "That needs an active assignment with your VA.",
  not_allowed: "That change isn't available.",
} as const;

function fromWrite<Field extends string>(result: Exclude<TaskWrite, { ok: true }>): SubmitResult<Field> {
  if ("missing" in result) return { ok: false, message: MISSING };
  if ("field" in result) {
    return { ok: false, message: FIELD_ERRORS, fieldErrors: { [result.field]: FIELD_COPY[result.field] } as Partial<Record<Field, string>> };
  }
  return { ok: false, message: FORM_COPY[result.form] };
}

/** The client adds a task for the VA on their active assignment. */
export async function createTask(formData: FormData): Promise<SubmitResult<TaskField>> {
  const user = await requireRole(["client"]);
  const parsed = parseCreate(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  let id = "";
  try {
    const created = await saveTask(user.id, parsed.value);
    if (!created.ok) return fromWrite(created);
    id = created.id;
  } catch (error) {
    return outageResult(error, "Adding a task");
  }
  redirect(clientTaskHref(id));
}

/** The client changes the title and deadline until the task is done. */
export async function updateTask(formData: FormData): Promise<SubmitResult<TaskField>> {
  const user = await requireRole(["client"]);
  const parsed = parseUpdate(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await editTask(user.id, parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Saving a task");
  }
  refresh();
  return { ok: true };
}

/** The client closes a task. The VA moves it forward. Neither reopens it. */
export async function setTaskStatus(formData: FormData): Promise<SubmitResult<TaskStatusField>> {
  await requireRole(["client", "va"]);
  const parsed = parseStatus(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await changeTaskStatus(parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Updating a task");
  }
  refresh();
  return { ok: true };
}

/** The client can comment after the assignment ends. The VA can comment only while it is active. */
export async function addTaskComment(formData: FormData): Promise<SubmitResult<CommentField>> {
  const user = await requireRole(["client", "va"]);
  const parsed = parseComment(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await addComment(user.id, parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Adding a comment");
  }
  refresh();
  return { ok: true };
}
