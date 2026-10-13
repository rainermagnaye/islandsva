import type { SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Field, controlClasses, describedBy } from "./field";
import { Icon } from "./icon";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id" | "className"> & {
  label: string;
  name: string;
  /** 2–15 options. Fewer than 4 → radios; more than 15 → a searchable combobox. */
  options: Array<string | SelectOption>;
  /** Rendered as a disabled empty first option. */
  placeholder?: string;
  id?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
};

/** Native <select>: free keyboard support, screen-reader semantics and the OS picker on phones. */
export function Select({ label, name, id = `field-${name}`, options, placeholder, hint, error, optional, className, ...rest }: SelectProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={rest.required} optional={optional}>
      <div className="relative">
        <select
          defaultValue={placeholder && rest.value === undefined && rest.defaultValue === undefined ? "" : undefined}
          {...rest}
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cx(controlClasses, "cursor-pointer appearance-none pr-11", className)}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => {
            const option = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            );
          })}
        </select>
        <Icon name="chevron-down" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted" />
      </div>
    </Field>
  );
}
