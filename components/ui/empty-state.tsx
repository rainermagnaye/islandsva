import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type EmptyStateProps = {
  /** What's empty, in plain words: "No leads yet", "No clients match this filter". */
  title: string;
  /** Why, or what will appear here. */
  description?: ReactNode;
  /** At most one primary Button, plus an optional secondary one. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Smaller, for inside panels and tables. */
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/** What a list, table or panel shows when it has nothing yet: the island illustration, a title and the next step. */
export function EmptyState({ title, description, action, secondaryAction, compact, headingLevel = 2, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cx(
        "grid justify-items-center gap-3 rounded-lg border-[1.5px] border-dashed border-border-strong bg-surface-card text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      {/* Decorative: sea, island, palm and sun from the logo's shapes, in brand hues that adapt to Night. */}
      <svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" className={compact ? "h-[70px] w-28" : "h-[100px] w-40"}>
        <path className="fill-brand-lagoon opacity-55" d="M0 74 Q20 66 40 74 T80 74 T120 74 T160 74 V100 H0Z" />
        <ellipse className="fill-brand-sand" cx={80} cy={74} rx={34} ry={9} />
        <path
          className="fill-none stroke-brand-palm"
          strokeWidth={3.5}
          strokeLinecap="round"
          d="M82 70 Q84 52 90 40 M90 40 Q78 34 68 40 M90 40 Q102 32 112 40 M90 40 Q86 28 78 25 M90 40 Q98 28 106 26"
        />
        <circle className="fill-brand-sunrise" cx={40} cy={32} r={12} />
      </svg>
      <Heading className="m-0 font-sans text-xl leading-7 font-semibold text-ink">{title}</Heading>
      {description && <p className="m-0 max-w-[44ch] text-ink-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
