/**
 * Outcome of a form submission, as consumed by `<Form>` — whether it went through `/api/v1` (api-client)
 * or a Server Action. Field errors are keyed by input `name`.
 */
export type SubmitResult<Field extends string = string> =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Partial<Record<Field, string>> };
