import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Field, describedBy } from "./field";

type FileFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "id" | "className"> & {
  /** Always visible. */
  label: string;
  name: string;
  /** Defaults to `field-${name}`. */
  id?: string;
  /** Accepted types and size limit, in words. */
  hint?: string;
  error?: string;
  optional?: boolean;
  /** One-line file control, matching a profile view cell. */
  compact?: boolean;
};

/** A file picker with the same label, hint and error wiring as TextField. */
export function FileField({ label, name, id = `field-${name}`, hint, error, optional, compact, ...rest }: FileFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={rest.required} optional={optional} compact={compact}>
      <input
        type="file"
        {...rest}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(
          "box-border block w-full min-w-0 max-w-full text-ink file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-sunken file:font-semibold file:text-ink hover:file:bg-action-ghost-hover",
          compact ? "h-9 max-h-9 type-body-sm file:h-7 file:px-2 file:py-0" : "type-body file:mr-3 file:min-h-11 file:px-3 file:py-2",
        )}
      />
    </Field>
  );
}
