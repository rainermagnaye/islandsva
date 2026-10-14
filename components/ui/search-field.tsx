import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./icon";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "placeholder"> & {
  /** What is searched ("Search teams"): the placeholder and, for screen readers, the label. */
  label: string;
  /** Sizes the field (it fills its column by default). */
  className?: string;
};

/** A search box with the magnifier inside: for filtering a list on the page. Controlled or uncontrolled. */
export function SearchField({ label, className, ...input }: SearchFieldProps) {
  return (
    <label className={cx("flex h-11 w-full items-center gap-2 rounded-md border-control border-border-strong bg-surface-card px-3.5", className)}>
      <span className="sr-only">{label}</span>
      <Icon name="search" className="text-ink-muted" />
      <input
        type="search"
        autoComplete="off"
        {...input}
        placeholder={label}
        className="w-full border-0 bg-transparent type-body text-ink outline-none placeholder:text-ink-muted"
      />
    </label>
  );
}
