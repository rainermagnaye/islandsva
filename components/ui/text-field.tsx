import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Field, controlClasses, describedBy } from "./field";

type BaseProps = {
  /** Always visible — placeholders never replace labels. */
  label: string;
  name: string;
  /** Defaults to `field-${name}`; set it when a name repeats on a page. */
  id?: string;
  hint?: string;
  /** Error text says how to fix it; sets aria-invalid. */
  error?: string;
  optional?: boolean;
  className?: string;
};

type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className"> & { multiline?: false };
type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id" | "className"> & { multiline: true };

export function TextField(props: InputProps | TextareaProps) {
  const { label, name, id = `field-${name}`, hint, error, optional, className, multiline, ...rest } = props;
  const control = {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, hint, error),
  };

  return (
    <Field id={id} label={label} hint={hint} error={error} required={rest.required} optional={optional}>
      {multiline ? (
        <textarea
          rows={5}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...control}
          className={cx(controlClasses, "resize-y", className)}
        />
      ) : (
        <input
          type="text"
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          {...control}
          className={cx(controlClasses, className)}
        />
      )}
    </Field>
  );
}
