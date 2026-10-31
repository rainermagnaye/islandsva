"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes, clientTaskHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { FIELD_ERRORS, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { TASK_LIMITS, type CommentField, type TaskField, type TaskNoteField, type TaskStatusField, type VaTaskField } from "./contract";
import { addComment, attachFiles, bookVaTask, removeBlock, changeTaskStatus, createTask as saveTask, editComment, editTask, removeComment, removeTask, sendBack, submitForReview, type TaskWrite } from "./service";
import { readFiles } from "./upload";
import { parseAttach, parseBlockId, parseComment, parseCommentDelete, parseCommentEdit, parseCreate, parseDelete, parseFeedback, parseStatus, parseSubmit, parseUpdate, parseVaTask } from "./validation";

const MISSING = "That task no longer exists. Refresh the page.";

const FIELD_COPY = {
  deadline: "Choose a date from today through the next year.",
  deadlineTime: "Choose a time that is still ahead.",
  vaId: "Choose the VA this task is for.",
} as const;

const FORM_COPY = {
  company: "That can be saved while your company is active.",
  assignment: "That needs an active assignment with your VA.",
  not_allowed: "That change isn't available.",
  attachments: `A task can have up to ${TASK_LIMITS.attachments} files.`,
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
  const entries = formEntries(formData);
  const stay = entries.stay === "1";
  const vaIds = formData.getAll("vaId").filter((value): value is string => typeof value === "string" && value.length > 0);
  const files = formData.getAll("attachment").filter((value): value is File => value instanceof File && value.size > 0);
  delete entries.stay;
  delete entries.vaId;
  delete entries.attachment;
  const parsed = parseCreate(entries);
  if (!parsed.ok) return toSubmitResult(parsed);
  const read = await readFiles(files);
  if (!read.ok) return { ok: false, message: read.message };
  let id = "";
  try {
    const created = await saveTask(user.id, { ...parsed.value, vaIds }, read.files);
    if (!created.ok) return fromWrite(created);
    id = created.id;
  } catch (error) {
    return outageResult(error, "Adding a task");
  }
  if (stay) {
    refresh();
    return { ok: true };
  }
  redirect(clientTaskHref(id));
}

/** The client changes the title, severity and deadline until the task is closed. */
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

/** The client removes their task, its comments and its files. */
export async function deleteTask(formData: FormData): Promise<SubmitResult<string>> {
  await requireRole(["client"]);
  const parsed = parseDelete(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const removed = await removeTask(parsed.value.taskId);
    if (!removed.ok) return fromWrite(removed);
  } catch (error) {
    return outageResult(error, "Deleting a task");
  }
  redirect(appRoutes.client);
}

/** A move without a note: the VA starts a task, the client approves a review or closes an open task. */
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

/** The VA hands the task over for the client's review. */
export async function submitTask(formData: FormData): Promise<SubmitResult<TaskNoteField>> {
  await requireRole(["va"]);
  const parsed = parseSubmit(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await submitForReview(parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Submitting a task for review");
  }
  refresh();
  return { ok: true };
}

/** The client requests changes on a review, or reopens a closed task. Either way the feedback is required. */
export async function sendTaskBack(formData: FormData): Promise<SubmitResult<TaskNoteField>> {
  await requireRole(["client"]);
  const parsed = parseFeedback(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await sendBack(parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Sending a task back");
  }
  refresh();
  return { ok: true };
}

/** The client adds files to an open task, up to the task's limit. */
export async function addTaskFiles(formData: FormData): Promise<SubmitResult<string>> {
  await requireRole(["client"]);
  const entries = formEntries(formData);
  const files = formData.getAll("attachment").filter((value): value is File => value instanceof File && value.size > 0);
  delete entries.attachment;
  const parsed = parseAttach(entries);
  if (!parsed.ok) return toSubmitResult(parsed);
  if (files.length === 0) return { ok: false, message: "Choose a file to add." };
  const read = await readFiles(files);
  if (!read.ok) return { ok: false, message: read.message };
  try {
    const saved = await attachFiles(parsed.value.taskId, read.files);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Adding files to a task");
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

/** The author rewrites their own comment. */
export async function editTaskComment(formData: FormData): Promise<SubmitResult<CommentField>> {
  await requireRole(["client", "va"]);
  const parsed = parseCommentEdit(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await editComment(parsed.value);
    if (!saved.ok) return fromWrite(saved);
  } catch (error) {
    return outageResult(error, "Editing a comment");
  }
  refresh();
  return { ok: true };
}

/** The author removes their own comment. */
export async function deleteTaskComment(formData: FormData): Promise<SubmitResult<string>> {
  await requireRole(["client", "va"]);
  const parsed = parseCommentDelete(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const removed = await removeComment(parsed.value.commentId);
    if (!removed.ok) return fromWrite(removed);
  } catch (error) {
    return outageResult(error, "Deleting a comment");
  }
  refresh();
  return { ok: true };
}

/** "Book › Task" on the VA calendar: a task for one of their clients, a to-do of their own, or time on a task. */
export async function bookVaTaskAction(formData: FormData): Promise<SubmitResult<VaTaskField>> {
  const user = await requireRole(["va"]);
  const parsed = parseVaTask(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await bookVaTask(user.id, parsed.value);
    if (!result.ok) {
      return result.field
        ? { ok: false, message: FIELD_ERRORS, fieldErrors: { [result.field]: result.message } as Partial<Record<VaTaskField, string>> }
        : { ok: false, message: result.message };
    }
  } catch (error) {
    return outageResult(error, "Booking a VA task");
  }
  refresh();
  return { ok: true };
}

/** Removes one of the VA's own blocks. A block that's already gone counts as removed. */
export async function removeBlockAction(formData: FormData): Promise<SubmitResult> {
  await requireRole(["va"]);
  const parsed = parseBlockId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    await removeBlock(parsed.value.blockId);
  } catch (error) {
    return outageResult(error, "Removing a calendar block");
  }
  refresh();
  return { ok: true };
}
