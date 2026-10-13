import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { Icon } from "./icon";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  info: "bg-status-info-bg text-status-info",
  success: "bg-status-success-bg text-status-success",
  warning: "bg-status-warning-bg text-status-warning",
  danger: "bg-status-danger-bg text-status-danger",
  brand: "bg-action-primary text-on-action-primary",
};

/** The icon each status tone shows by default (shared with Alert). */
export const STATUS_ICONS = { info: "info", success: "check-circle", warning: "alert-triangle", danger: "x-circle" } as const satisfies Partial<
  Record<BadgeTone, IconName>
>;

type BadgeProps = {
  tone?: BadgeTone;
  /** sm = table cells and dense rows. */
  size?: "sm" | "md";
  /** Overrides the tone's icon; null shows none. */
  icon?: IconName | null;
  /** A coloured dot instead of the icon. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * A rounded status or category label. The word carries the meaning; colour and icon reinforce it.
 * `brand` (sunrise) is for marketing highlights only, never status. Not a button: filters are links.
 */
export function Badge({ tone = "neutral", size = "md", icon, dot, children, className }: BadgeProps) {
  const shown = icon === undefined ? (STATUS_ICONS as Partial<Record<BadgeTone, IconName>>)[tone] : icon;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill font-sans font-semibold whitespace-nowrap",
        size === "sm" ? "min-h-[22px] px-2 text-[0.75rem] leading-4" : "min-h-[26px] px-2.5 text-[0.8125rem] leading-[1.125rem]",
        tones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-[7px] flex-none rounded-full bg-current" /> : shown && <Icon name={shown} size={15} />}
      <span>{children}</span>
    </span>
  );
}

/** An unread or pending count. Always carries a screen-reader label ("3 new leads"). */
export function CountBadge({ count, label, max = 99 }: { count: number; label: string; max?: number }) {
  return (
    <span className="inline-grid h-5 min-w-5 place-items-center rounded-pill bg-status-danger px-1.5 font-sans text-[0.75rem] leading-none font-bold text-surface-card">
      <span aria-hidden="true">{count > max ? `${max}+` : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
