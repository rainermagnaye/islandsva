import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/components/ui/date-math";
import { cx } from "@/lib/cx";
import type { AgendaItem, AgendaKind } from "../agenda";

const DOT: Record<AgendaKind, string> = { deadline: "bg-tag-coral-ink", meeting: "bg-tag-ocean-ink", demo: "bg-tag-lagoon-ink" };

/** This week's calls and meetings. Each row opens its href, or the calendar when the item has none. */
export function ThisWeekCard({
  items,
  today,
  calendarHref,
  empty = "Nothing to confirm or attend this week.",
}: {
  items: readonly AgendaItem[];
  today: string;
  calendarHref: string;
  empty?: string;
}) {
  return (
    <Card as="section" padding="none" aria-labelledby="this-week" className="grid h-full w-full content-start gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="this-week" className="m-0 type-h4">
          This week
        </h2>
        <Link href={calendarHref} className="type-label no-underline">
          Calendar
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href ?? calendarHref} className="flex items-center gap-3 rounded-md bg-surface-sunken px-3.5 py-3 text-ink no-underline hover:bg-action-ghost-hover">
                <span className={cx("flex w-12 shrink-0 flex-col items-center gap-1", item.date === today ? "text-action-secondary" : "text-ink")}>
                  <span className="type-caption font-bold uppercase">{item.date === today ? "Today" : formatDate(item.date, { weekday: "short" })}</span>
                  <span className="type-h4 font-bold tabular-nums">{Number(item.date.slice(8, 10))}</span>
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-pill", DOT[item.kind])} />
                    <span className="truncate type-body-sm font-semibold">{item.title}</span>
                  </span>
                  <span className="type-caption text-ink-muted">
                    {item.when}
                    {item.who ? ` · ${item.who}` : ""}
                    {item.badge ? ` · ${item.badge.label}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
