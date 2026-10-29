import Link from "next/link";
import { cx } from "@/lib/cx";
import { Icon } from "./icon";

type StepperProps = {
  steps: readonly { label: string; description?: string; href?: string }[];
  /** 0-based index of the current step. `steps.length` means every step is done. */
  current: number;
  label?: string;
  className?: string;
};

/**
 * Progress through a short flow (3–6 steps): done steps teal with a check (links when they have an href), the
 * current one a sunrise mark with aria-current="step", the rest outlined. A text summary leads for screen
 * readers and small screens; vertical below 720px of container width.
 */
export function Stepper({ steps, current, label = "Progress", className }: StepperProps) {
  const now = steps[current];
  return (
    <nav aria-label={label} className={cx("@container grid gap-3", className)}>
      <p className="m-0 type-label text-ink">
        {current >= steps.length ? `All ${steps.length} steps done` : `Step ${current + 1} of ${steps.length}${now ? `: ${now.label}` : ""}`}
      </p>
      <ol className="m-0 grid list-none gap-3 p-0 @[720px]:grid-flow-col @[720px]:auto-cols-fr">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "upcoming";
          const mark = (
            <span
              aria-hidden="true"
              className={cx(
                "grid size-8 shrink-0 place-items-center rounded-pill type-label",
                state === "done" && "bg-action-secondary text-on-action-secondary",
                state === "current" && "bg-action-primary text-on-action-primary ring-4 ring-action-primary/20",
                state === "upcoming" && "border-control border-border-strong text-ink-muted",
              )}
            >
              {state === "done" ? <Icon name="check" size={16} /> : index + 1}
            </span>
          );
          const text = (
            <span className="grid min-w-0">
              <span className={cx("type-label", state === "upcoming" ? "text-ink-muted" : "text-ink")}>{step.label}</span>
              {step.description && <span className="type-body-sm text-ink-muted">{step.description}</span>}
            </span>
          );
          return (
            <li key={step.label} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 items-start gap-3">
              {state === "done" && step.href ? (
                <Link href={step.href} className="flex min-h-11 items-start gap-3 no-underline">
                  {mark}
                  {text}
                </Link>
              ) : (
                <>
                  {mark}
                  {text}
                </>
              )}
              <span className="sr-only">{state === "done" ? "(done)" : state === "upcoming" ? "(not started)" : ""}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
