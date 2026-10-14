import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { cardSurface } from "./card";
import { Icon } from "./icon";

const count = new Intl.NumberFormat("en-US");

type StatCardProps = {
  label: string;
  value: number;
  unit?: string;
  icon?: IconName;
  /** A line under the number, e.g. "vs last month". */
  caption?: ReactNode;
  /** The whole card links to the list behind the number. */
  href?: string;
};

/**
 * One headline number for a dashboard. The value is the hero (Alegreya 32px, tabular figures); never
 * more than one number per card. Place 2–4 in a row.
 */
export function StatCard({ label, value, unit, icon, caption, href }: StatCardProps) {
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
        {count.format(value)}
        {unit && <span className="type-menu text-ink-muted"> {unit}</span>}
      </p>
      {caption && <p className="m-0 type-body-sm text-ink-muted">{caption}</p>}
    </>
  );
  const card = cx(cardSurface, "grid min-w-0 content-start gap-2 p-5 transition-colors");

  return href ? (
    <Link href={href} aria-label={`${label}: ${count.format(value)}`} className={cx(card, "text-ink no-underline hover:border-border-strong hover:elevation-sm")}>
      {body}
    </Link>
  ) : (
    <section aria-label={label} className={cx(card, "hover:border-border-strong")}>
      {body}
    </section>
  );
}
