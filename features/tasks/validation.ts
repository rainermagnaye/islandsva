import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, parseWith, tooLong } from "@/lib/validation";
import { TASK_LIMITS, TASK_STATUSES, type CommentField, type TaskField, type TaskStatusField } from "./contract";

// Dates are calendar days (YYYY-MM-DD). The database checks the window in the client's zone; this only
// checks that the day is real, so a day that is "today" there and "yesterday" in UTC still parses.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const title = z
  .string({ error: "Enter a title." })
  .trim()
  .min(1, "Enter a title.")
  .max(TASK_LIMITS.title, tooLong("the title", TASK_LIMITS.title))
  .regex(NO_CONTROL_CHARS, "Remove any unusual characters from the title.");

const deadline = z.string({ error: "Choose a date." }).refine(realDate, "Choose a date.");

const createSchema = z.strictObject({
  title,
  deadline,
  vaId: z.uuid({ error: "Choose the VA this task is for." }).optional(),
});

/** "Add a task": a title and a deadline. The VA is chosen by the server from the one active assignment. */
export const parseCreate = (input: unknown) => parseWith<typeof createSchema, TaskField>(createSchema, input, ["title", "deadline", "vaId"]);

const updateSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  title,
  deadline,
});

/** The client changes the title and deadline until the task is done. */
export const parseUpdate = (input: unknown) => parseWith<typeof updateSchema, TaskField>(updateSchema, input, ["title", "deadline"]);

const statusSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  status: z.enum(TASK_STATUSES, { error: FORM_ERROR }),
});

/** A forward status move. A value outside the enum is a tampered form, not a field the user can fix. */
export const parseStatus = (input: unknown) => parseWith<typeof statusSchema, TaskStatusField>(statusSchema, input, []);

const commentSchema = z.strictObject({
  taskId: z.uuid({ error: FORM_ERROR }),
  body: z
    .string({ error: "Write a comment." })
    .trim()
    .min(1, "Write a comment.")
    .max(TASK_LIMITS.comment, tooLong("the comment", TASK_LIMITS.comment))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the comment."),
});

/** An append-only comment. No files. */
export const parseComment = (input: unknown) => parseWith<typeof commentSchema, CommentField>(commentSchema, input, ["body"]);
