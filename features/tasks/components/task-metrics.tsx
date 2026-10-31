import Link from "next/link";
import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard } from "@/components/ui/stat-card";
import { cx } from "@/lib/cx";
import { performance, type TaskMetric } from "../metrics";

const linkedCard = cx(cardSurface, "grid min-w-0 content-start gap-2 p-5 text-ink no-underline transition-colors hover:border-border-strong hover:elevation-sm");

/**
 * Tasks done, on-time rate and overdue — and, when `delayed` is given, open tasks worked past their duration.
 * A rate with no completed tasks is an em dash, never 0%.
 */
export function TaskMetrics({ tasks, href, delayed, now = new Date() }: { tasks: readonly TaskMetric[]; href?: string; delayed?: number; now?: Date }) {
  const figures = performance(tasks, now);
  const percent = figures.onTimeRate === null ? null : Math.round(figures.onTimeRate * 100);

  return (
    <section aria-label="Task figures" className={cx("grid gap-4", delayed === undefined ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
      <StatCard label="Tasks done" value={figures.done} icon="check" href={href} />
      <OnTime percent={percent} href={href} />
      <StatCard label="Overdue" value={figures.overdue} icon="alert-triangle" href={href} caption="Past the deadline" />
      {delayed !== undefined && <StatCard label="Delayed" value={delayed} icon="clock" href={href} caption="Worked past the duration" />}
    </section>
  );
}

function OnTime({ percent, href }: { percent: number | null; href?: string }) {
  if (percent !== null) return <StatCard label="On-time rate" value={percent} unit="%" icon="clock" href={href} />;
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-status-info-bg text-action-secondary">
          <Icon name="clock" size={18} />
        </span>
        <p className="m-0 flex-1 type-label text-ink-muted">On-time rate</p>
      </div>
      <p className="m-0 type-stat text-ink">—</p>
    </>
  );
  return href ? (
    <Link href={href} aria-label="On-time rate: none yet" className={linkedCard}>
      {body}
    </Link>
  ) : (
    <section aria-label="On-time rate: none yet" className={cx(cardSurface, "grid min-w-0 content-start gap-2 p-5")}>
      {body}
    </section>
  );
}
