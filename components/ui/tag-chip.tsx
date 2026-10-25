import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { TONE_CLASSES, type Tone } from "./tone";

type TagChipProps = {
  children: ReactNode;
  tone?: Tone;
  /** A link when it filters; omitted = a static label (inside cards). */
  href?: string;
  /** The active filter: filled, with aria-current. */
  current?: boolean;
  count?: number;
  /** sm (24px) is for inside cards only; standalone chips are 36px. */
  size?: "sm" | "md";
  className?: string;
};

/** A category or tag in one of the four tones: a dot and the word, never colour alone. */
export function TagChip({ children, tone = "lagoon", href, current = false, count, size = "md", className }: TagChipProps) {
  const t = TONE_CLASSES[tone];
  const classes = cx(
    "inline-flex items-center gap-1.5 rounded-pill font-semibold whitespace-nowrap no-underline",
    size === "sm" ? "min-h-6 px-2.5 type-caption" : "min-h-9 px-3.5 type-body-sm",
    current ? cx(t.fill, "text-surface-card") : cx(t.bg, t.ink),
    href && !current && "transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:ring-[1.5px] motion-reduce:hover:translate-y-0",
    href && t.ring,
    className,
  );
  const body = (
    <>
      <span aria-hidden="true" className={cx("size-1.5 rounded-pill", current ? "bg-surface-card" : t.fill)} />
      {children}
      {count !== undefined && (
        <span className="tabular-nums opacity-80">
          {count}
          <span className="sr-only"> posts</span>
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} aria-current={current ? "page" : undefined} className={classes}>
      {body}
    </Link>
  ) : (
    <span className={classes}>{body}</span>
  );
}
