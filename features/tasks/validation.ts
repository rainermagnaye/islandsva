import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, parseWith, tooLong } from "@/lib/validation";
import { TASK_LIMITS, TASK_SEVERITIES, TASK_STATUSES, type CommentField, type TaskField, type TaskNoteField, type TaskStatusField } from "./contract";

// Dates are calendar days (YYYY-MM-DD). The database checks the window in the client's zone; this only
// checks that the day is real, so a day that is "today" there and "yesterday" in UTC still parses.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const realDate = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const title = z
  .string({ error: "Enter a title." })
  .trim()
  .min(1, "Enter a title.")
  .max(TASK_LIMITS.title, tooLong("the title", TASK_LIMITS.title))
  .regex(NO_CONTROL_CHARS, "Remove any unusual characters from the title.");

const deadline = z.string({ error: "Choose a date." }).refine(realDate, "Choose a date.");

const deadlineTime = z
  .string({ error: "Choose a time." })
  .trim()
  .transform((value) => value.slice(0, 5))
  .refine((value) => CLOCK.test(value), "Choose a time.");

const description = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .min(1, "Write a description, or leave it empty.")
    .max(TASK_LIMITS.description, tooLong("the description", TASK_LIMITS.description))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the description."),
]);

const createSchema = z.strictObject({
  title,
  description: description.optional(),
  severity: z.enum(TASK_SEVERITIES, { error: "Choose a severity." }).optional(),
  deadline,
  deadlineTime,
  vaId: z.uuid({ error: "Choose the VA this task is for." }).optional(),
});

/** "Add a task": a title, a severity, a date and a time. The description is optional. Each chosen VA gets a task. */
export const parseCreate = (input: unknown) => parseWith<typeof createSchema, TaskField>(createSchema, input, ["title", "description", "severity", "deadline", "deadlineTime", "vaId"]);

const updateSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  title,
  description: description.optional(),
  deadline,
  deadlineTime,
});

/** The client changes the title, date and time until the task is done. */
export const parseUpdate = (input: unknown) => parseWith<typeof updateSchema, TaskField>(updateSchema, input, ["title", "description", "deadline", "deadlineTime"]);

const statusSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  status: z.enum(TASK_STATUSES, { error: FORM_ERROR }),
});

/** A forward status move. A value outside the enum is a tampered form, not a field the user can fix. */
export const parseStatus = (input: unknown) => parseWith<typeof statusSchema, TaskStatusField>(statusSchema, input, []);

const noteText = (empty: string) =>
  z
    .string({ error: empty })
    .trim()
    .min(1, empty)
    .max(TASK_LIMITS.note, tooLong("the note", TASK_LIMITS.note))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the note.");

const submitSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  note: z.union([z.literal(""), noteText("Write a note, or leave it empty.")]).optional(),
});

/** The VA hands the task over for review. The note (what was done, where to find it) is optional. */
export const parseSubmit = (input: unknown) => parseWith<typeof submitSchema, TaskNoteField>(submitSchema, input, ["note"]);

const feedbackSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  note: noteText("Write what needs to change."),
});

/** The client sends the task back to the VA (request changes, or reopen). The feedback is required. */
export const parseFeedback = (input: unknown) => parseWith<typeof feedbackSchema, TaskNoteField>(feedbackSchema, input, ["note"]);

const attachSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
});

/** Files added to a task after it was created. The files themselves are checked by the action. */
export const parseAttach = (input: unknown) => parseWith<typeof attachSchema, string>(attachSchema, input, []);

const deleteSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
});

/** Delete one task. A bad id is a tampered form. */
export const parseDelete = (input: unknown) => parseWith<typeof deleteSchema, string>(deleteSchema, input, []);

const commentSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  body: z
    .string({ error: "Write a comment." })
    .trim()
    .min(1, "Write a comment.")
    .max(TASK_LIMITS.comment, tooLong("the comment", TASK_LIMITS.comment))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the comment."),
});

/** A new comment. No files. */
export const parseComment = (input: unknown) => parseWith<typeof commentSchema, CommentField>(commentSchema, input, ["body"]);

const commentEditSchema = z.strictObject({
  commentId: z.uuid({ error: FORM_ERROR }),
  body: commentSchema.shape.body,
});

/** The author rewrites one comment. A bad id is a tampered form. */
export const parseCommentEdit = (input: unknown) => parseWith<typeof commentEditSchema, CommentField>(commentEditSchema, input, ["body"]);

const commentDeleteSchema = z.strictObject({
  commentId: z.uuid({ error: FORM_ERROR }),
});

/** The author removes one comment. A bad id is a tampered form. */
export const parseCommentDelete = (input: unknown) => parseWith<typeof commentDeleteSchema, string>(commentDeleteSchema, input, []);
