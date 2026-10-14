import type { ReactNode } from "react";
import { Icon } from "./icon";

export const controlClasses =
  "forced-border w-full min-h-11 rounded-md border-control border-border-strong bg-surface-card px-3 py-2.5 type-body text-ink transition-[border-color,box-shadow] duration-100 placeholder:text-ink-muted placeholder:opacity-100 hover:border-ink-muted focus-visible:border-focus-ring focus-visible:outline-offset-1 aria-invalid:border-2 aria-invalid:border-status-danger disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-fill disabled:text-disabled-ink";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
};

/** Label, hint and error wiring shared by TextField and Select. Ids: `${id}-hint`, `${id}-error`. */
export function Field({ id, label, hint, error, required, optional, children }: FieldProps) {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <label htmlFor={id} className="type-label text-ink">
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
