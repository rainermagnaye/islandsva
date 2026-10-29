import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { cardSurface } from "./card";
import { Icon } from "./icon";
import { Sparkline } from "./sparkline";

const count = new Intl.NumberFormat("en-US");

type StatCardProps = {
  label: string;
  /** Null shows an em dash: nothing to count yet (never a misleading 0 or 0%). */
  value: number | null;
  unit?: string;
  icon?: IconName;
  /** A line under the number, e.g. "vs last month". */
  caption?: ReactNode;
  /** The whole card links to the list behind the number. */
  href?: string;
  /** Change since the last period. `good` overrides "up is good" (a faster reply time is down and good). */
  delta?: { value: string; direction: "up" | "down"; good?: boolean };
  /** A short explanation of how the number is counted. */
  help?: string;
  /** Recent values for a sparkline, oldest first. */
  trend?: readonly number[];
  trendLabels?: readonly string[];
};

/**
 * One headline number for a dashboard. The value is the hero (Alegreya 32px, tabular figures); never
 * more than one number per card. Place 2–4 in a row.
 */
export function StatCard({ label, value, unit, icon, caption, href, delta, help, trend, trendLabels }: StatCardProps) {
  const good = delta ? (delta.good ?? delta.direction === "up") : false;
  const shown = value === null ? "—" : count.format(value);
  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="grid size-8 place-items-center rounded-md bg-status-info-bg text-action-secondary">
            <Icon name={icon} size={18} />
          </span>
        )}
        <p className="m-0 flex-1 type-label text-ink-muted">{label}</p>
      </div>
      <p className="m-0 type-stat text-ink">
        {shown}
        {unit && value !== null && <span className="type-menu text-ink-muted"> {unit}</span>}
      </p>
      {(delta || trend) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          {delta && (
            <span className={cx("inline-flex items-center gap-1 type-label", good ? "text-status-success" : "text-status-danger")}>
              <Icon name={delta.direction === "up" ? "arrow-up" : "arrow-down"} size={14} />
              {delta.value}
              <span className="sr-only">{good ? " (better)" : " (worse)"}</span>
            </span>
          )}
          {trend && <Sparkline data={trend} labels={trendLabels} format={(v) => count.format(v)} />}
        </div>
      )}
      {caption && <p className="m-0 type-body-sm text-ink-muted">{caption}</p>}
      {help && <p className="m-0 type-caption text-ink-muted">{help}</p>}
    </>
  );
  const card = cx(cardSurface, "grid min-w-0 content-start gap-2 p-5 transition-colors");

  return href ? (
    <Link href={href} aria-label={`${label}: ${value === null ? "none yet" : shown}`} className={cx(card, "text-ink no-underline hover:border-border-strong hover:elevation-sm")}>
      {body}
    </Link>
  ) : (
    <section aria-label={label} className={cx(card, "hover:border-border-strong")}>
      {body}
    </section>
  );
}
