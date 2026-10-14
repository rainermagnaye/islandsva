import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label: string;
  description?: string;
  /** Defaults to `check-${name}-${value}`. */
  id?: string;
  className?: string;
};

/** For choices submitted with a form. Consent boxes are never pre-checked. */
export function Checkbox({ label, description, id, className, ...rest }: CheckboxProps) {
  const inputId = id ?? `check-${rest.name ?? "field"}${rest.value !== undefined ? `-${rest.value}` : ""}`;
  return (
    <label
      htmlFor={inputId}
      className={cx(
        "grid min-h-11 cursor-pointer grid-cols-[24px_1fr] items-start gap-3 pt-2.5 text-ink has-disabled:cursor-not-allowed has-disabled:text-disabled-ink",
        className,
      )}
    >
      <input
        type="checkbox"
        id={inputId}
        aria-describedby={description ? `${inputId}-desc` : undefined}
        className="forced-border grid size-[22px] cursor-pointer appearance-none place-items-center rounded-sm border-control border-border-strong bg-surface-card transition-colors duration-100 after:h-[7px] after:w-3 after:translate-x-px after:-translate-y-px after:-rotate-45 after:border-b-[2.5px] after:border-l-[2.5px] after:border-on-action-secondary after:opacity-0 after:content-[''] checked:border-action-secondary checked:bg-action-secondary checked:after:opacity-100 disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-fill"
        {...rest}
      />
      <span className="grid gap-0.5">
        <span className="font-sans text-[1rem] leading-[22px] font-medium">
          {label}
        </span>
        {description && (
          <span id={`${inputId}-desc`} className="type-body-sm text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
