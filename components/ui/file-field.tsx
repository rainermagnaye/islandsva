import type { InputHTMLAttributes } from "react";
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
};

/** A file picker with the same label, hint and error wiring as TextField. */
export function FileField({ label, name, id = `field-${name}`, hint, error, optional, ...rest }: FileFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={rest.required} optional={optional}>
      <input
        type="file"
        {...rest}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className="block w-full type-body text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-2 file:font-semibold file:text-ink hover:file:bg-action-ghost-hover"
      />
    </Field>
  );
}
