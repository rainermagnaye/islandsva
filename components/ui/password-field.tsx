"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Field, controlClasses, describedBy } from "./field";
import { Icon } from "./icon";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className" | "type"> & {
  label: string;
  name: string;
  id?: string;
  hint?: string;
  error?: string;
};

/**
 * A password input with a show/hide button, so people can check what they typed. The button comes after the input
 * in tab order, announces its state (aria-pressed), and never submits the form.
 */
export function PasswordField({ label, name, id = `field-${name}`, hint, error, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} hint={hint} error={error} required={rest.required}>
      <div className="relative w-full min-w-0">
        <input
          {...rest}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cx(controlClasses, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-muted hover:text-ink focus-visible:outline-offset-0"
        >
          <Icon name={visible ? "eye-off" : "eye"} size={20} />
        </button>
      </div>
    </Field>
  );
}
