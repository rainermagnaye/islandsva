import type { ReactNode } from "react";
import { Icon } from "./icon";

export const controlClasses =
  "forced-border w-full min-h-11 rounded-md border-control border-border-strong bg-surface-card px-3 py-2.5 type-body text-ink transition-[border-color,box-shadow] duration-100 placeholder:text-ink-muted placeholder:opacity-100 hover:border-ink-muted focus-visible:border-focus-ring focus-visible:outline-offset-1 aria-invalid:border-2 aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-fill disabled:text-disabled-ink";

/** Same border and type as a control, locked to one line so a profile field matches the view cell. */
export const compactControlClasses =
  "forced-border box-border h-9 max-h-9 min-h-9 w-full min-w-0 max-w-full rounded-md border-control border-border-strong bg-surface-card px-2 py-1 type-body-sm text-ink transition-[border-color,box-shadow] duration-100 placeholder:text-ink-muted placeholder:opacity-100 hover:border-ink-muted focus-visible:border-focus-ring focus-visible:outline-offset-1 aria-invalid:border-2 aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-fill disabled:text-disabled-ink";

/** Multi-line profile fields: a fixed block, so typing does not grow the card. */
export const compactAreaClasses =
  "forced-border box-border h-[4.5rem] max-h-[4.5rem] min-h-[4.5rem] w-full min-w-0 max-w-full resize-none rounded-md border-control border-border-strong bg-surface-card px-2 py-1 type-body-sm text-ink transition-[border-color,box-shadow] duration-100 placeholder:text-ink-muted placeholder:opacity-100 hover:border-ink-muted focus-visible:border-focus-ring focus-visible:outline-offset-1 aria-invalid:border-2 aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-fill disabled:text-disabled-ink";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  /** Caption label and a tighter stack, matching a read-only profile row. */
  compact?: boolean;
  children: ReactNode;
};

/** Label, hint and error wiring shared by TextField and Select. Ids: `${id}-hint`, `${id}-error`. */
export function Field({ id, label, hint, error, required, optional, compact, children }: FieldProps) {
  return (
    <div className={compact ? "grid min-w-0 content-start gap-1" : "grid min-w-0 content-start gap-2"}>
      <label htmlFor={id} className={compact ? "type-caption text-ink-muted" : "type-label text-ink"}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-status-danger">
            *
          </span>
        )}
        {optional && <span className="type-body-sm text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="m-0 type-body-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="m-0 flex items-center gap-1 type-label text-status-danger">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}
