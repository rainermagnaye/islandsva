import "server-only";
import { z } from "zod";
import type { SubmitResult } from "@/types/form";

// Building blocks for every feature's validation.ts, so all inputs are checked and reported the same way.

export const FORM_ERROR = "Something went wrong with the form. Please refresh the page and try again.";
export const FIELD_ERRORS ="Please check the highlighted fields.";

// No control characters; multi-line text may also contain \t \n \r.
export const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;
export const NO_CONTROL_CHARS_EXCEPT_WHITESPACE = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const tooLong = (what: string, max: number) => `Keep ${what} under ${max} characters.`;

/** Trimmed, lower-cased email address (254 is the RFC 5321 maximum). */
export function emailField(max = 254) {
  const incomplete = "That email doesn't look complete — try name@company.com.";
  return z
    .string({ error: "Enter your email address." })
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address.")
    .max(max, incomplete)
    .regex(EMAIL_SHAPE, incomplete);
}

export type Parsed<T, Field extends string> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Partial<Record<Field, string>> }
  // Not tied to a field the user can fix (tampered or stale form): shown as a form-level message.
  | { ok: false; formError: string };

/**
 * Runs a schema and reports problems the way forms show them: the first message per input `name`, or one
 * form-level error when the problem isn't a field the user can fix (not an object, unknown keys, …).
 */
export function parseWith<Schema extends z.ZodType, Field extends string>(
  schema: Schema,
  input: unknown,
  fields: readonly Field[],
): Parsed<z.output<Schema>, Field> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const { issues } = result.error;
  if (issues.some((issue) => issue.code === "unrecognized_keys" || issue.path.length === 0)) {
    return { ok: false, formError: FORM_ERROR };
  }
  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (fields as readonly string[]).includes(field)) fieldErrors[field as Field] ??= issue.message;
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: false, formError: FORM_ERROR };
}

/** A failed parse as the result a `<Form>` displays. */
export function toSubmitResult<Field extends string>(failure: Exclude<Parsed<unknown, Field>, { ok: true }>): SubmitResult<Field> {
  return "formError" in failure
    ? { ok: false, message: failure.formError }
    : { ok: false, message: FIELD_ERRORS, fieldErrors: failure.fieldErrors };
}

/** FormData as a plain object for parseWith. Files stay File objects, so string schemas reject them. */
export const formEntries = (formData: FormData): Record<string, unknown> => Object.fromEntries(formData);
