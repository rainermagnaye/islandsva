import { useId } from "react";
import { cx } from "@/lib/cx";

type ProgressBarProps = {
  label: string;
  value: number;
  max?: number;
  /** The number in words, e.g. "34 of 40 hours". Always shown, so colour is never the only signal. */
  valueText?: string;
  hint?: string;
  /** Percent at which the bar turns warning (default 85); it turns danger at 100. */
  warnAt?: number;
  className?: string;
};

/** How much of something is used or done: plan hours, onboarding, an upload. */
export function ProgressBar({ label, value, max = 100, valueText, hint, warnAt = 85, className }: ProgressBarProps) {
  const id = useId();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const text = valueText ?? `${Math.round(percent)}%`;
  const tone = percent >= 100 ? "bg-status-danger" : percent >= warnAt ? "bg-status-warning" : "bg-action-secondary";

  return (
    <div className={cx("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="type-label text-ink">
          {label}
        </span>
        <span className="type-body-sm text-ink-muted tabular-nums">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-2 overflow-hidden rounded-pill bg-surface-sunken"
      >
        <div className={cx("h-full rounded-pill transition-[width] duration-300 motion-reduce:transition-none", tone)} style={{ width: `${percent}%` }} />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="m-0 type-body-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
