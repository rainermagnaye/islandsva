import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type Step = { title?: string; body: ReactNode };

const sizes = {
  sm: { number: "size-8", gap: "gap-3", list: "gap-4" },
  md: { number: "size-10", gap: "gap-4", list: "gap-5" },
} as const;

type StepListProps = {
  steps: readonly Step[];
  /** sm = a short sidebar list; md = a page section with titled steps. */
  size?: keyof typeof sizes;
  /** Added to each step, e.g. `reveal` for the scroll-in animation on marketing pages. */
  itemClassName?: string;
  className?: string;
};

/** A numbered sequence ("what happens next"): each number in a tinted circle, then the step. */
export function StepList({ steps, size = "md", itemClassName, className }: StepListProps) {
  const s = sizes[size];
  return (
    <ol className={cx("m-0 grid list-none p-0", s.list, className)}>
      {steps.map((step, i) => (
        <li key={i} className={cx("grid grid-cols-[auto_1fr]", s.gap, itemClassName)}>
          <span className={cx("grid place-items-center rounded-pill bg-status-info-bg type-label text-action-secondary", s.number)}>{i + 1}</span>
          {step.title ? (
            <div className="grid gap-1">
              <h3 className="m-0 type-h4">{step.title}</h3>
              <p className="m-0 text-ink-muted">{step.body}</p>
            </div>
          ) : (
            <span className="text-ink-muted">{step.body}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
