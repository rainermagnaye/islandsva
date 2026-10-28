"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import type { AgendaItem, AgendaKind } from "../agenda";

const DOT: Record<AgendaKind, string> = {
  deadline: "bg-tag-coral-ink",
  meeting: "bg-tag-ocean-ink",
  demo: "bg-tag-lagoon-ink",
};

const itemClass = "grid w-full grid-cols-[0.625rem_minmax(0,1fr)] items-start gap-x-3 rounded-md bg-surface-sunken px-3.5 py-3 text-left text-ink no-underline hover:bg-action-ghost-hover";

/**
 * Beside the calendar: a link to the tasks waiting for review, then what's coming up, grouped by day. On wide
 * screens it fills the calendar card's height and scrolls inside, so the two line up.
 */
export function ComingUp({ items, review, onOpenBooking }: { items: readonly AgendaItem[]; review: { count: number; href: string } | null; onOpenBooking: (id: string) => void }) {
  const groups: { label: string; items: AgendaItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }

  return (
    <div className="relative w-full min-h-72">
      <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
        {review && (
          <Link href={review.href} className="flex shrink-0 items-center gap-3 rounded-md border border-status-warning bg-status-warning-bg p-4 text-ink no-underline">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-pill bg-surface-card text-status-warning">
              <Icon name="inbox" />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <strong className="type-body-sm">{review.count === 1 ? "1 task is waiting for your review" : `${review.count} tasks are waiting for your review`}</strong>
              <span className="type-body-sm">Review it before the deadline passes.</span>
            </span>
            <Icon name="chevron-right" />
          </Link>
        )}
        <section aria-labelledby="coming-up" className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-surface-card p-5">
          <h2 id="coming-up" className="m-0 type-h4">
            Coming up
          </h2>
          <div className="-mr-2 grid min-h-0 flex-1 content-start gap-5 overflow-y-auto pr-2">
            {groups.length === 0 ? (
              <p className="m-0 type-body-sm text-ink-muted">Nothing coming up for these filters.</p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="grid gap-2">
                  <h3 className={cx("m-0 type-eyebrow", group.label === "Overdue" ? "text-status-danger" : "text-ink-muted")}>{group.label}</h3>
                  <ul className="m-0 grid list-none gap-2 p-0">
                    {group.items.map((item) => {
                      const body = (
                        <>
                          <span aria-hidden="true" className={cx("mt-1.5 size-2.5 rounded-pill", group.label === "Overdue" ? "bg-status-danger" : DOT[item.kind])} />
                          <span className="grid min-w-0 justify-items-start gap-1">
                            <span className="max-w-full truncate font-semibold">{item.title}</span>
                            <span className="type-caption text-ink-muted">{item.when}</span>
                            {item.badge && (
                              <Badge tone={item.badge.tone} size="sm" className="mt-1">
                                {item.badge.label}
                              </Badge>
                            )}
                          </span>
                        </>
                      );
                      return (
                        <li key={item.key}>
                          {item.href ? (
                            <Link href={item.href} className={itemClass}>
                              {body}
                            </Link>
                          ) : (
                            <button type="button" className={cx(itemClass, "cursor-pointer border-0")} onClick={() => item.bookingId && onOpenBooking(item.bookingId)}>
                              {body}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
