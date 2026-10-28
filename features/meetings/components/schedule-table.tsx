"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";
import { BOOKING_TIME_ZONE } from "../contract";
import { SCHEDULE_KIND_LABELS, type ScheduleKind, type ScheduleRow } from "../schedule";

const FILTERS = [["all", "All"], ["meeting", "Meetings"], ["task", "Tasks"], ["demo", "Demo calls"]] as const;
type Filter = (typeof FILTERS)[number][0];

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: BOOKING_TIME_ZONE });
const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: BOOKING_TIME_ZONE });

function when(row: ScheduleRow) {
  const start = new Date(row.at);
  if (!row.end) return { title: day.format(start), subtitle: `Due ${time.format(start)}` };
  const end = new Date(row.end);
  const sameDay = day.format(start) === day.format(end);
  return {
    title: day.format(start),
    subtitle: sameDay ? `${time.format(start)} – ${time.format(end)}` : `${time.format(start)} – ${day.format(end)}, ${time.format(end)}`,
  };
}

const EMPTY: Record<ScheduleKind, string> = { meeting: "No meetings", task: "No tasks with a deadline", demo: "No demo calls" };

/**
 * Everything on the client's calendar as one list, newest first, filtered by type. A meeting opens its details;
 * a task opens the task, a demo call VA Match. Plain markup so the calendar doesn't pay for the selectable
 * DataTable on first load.
 */
export function ScheduleTable({ rows, onOpenBooking }: { rows: readonly ScheduleRow[]; onOpenBooking: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? rows : rows.filter((row) => row.kind === filter);
  const count = shown.length === 1 ? "1 item" : `${shown.length} items`;

  return (
    <div className="grid gap-4">
      <h2 className="m-0 type-h2">Schedules</h2>
      <nav aria-label="Filter schedules by type" className="flex gap-1 overflow-x-auto border-b border-border">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={filter === value ? "page" : undefined}
            onClick={() => setFilter(value)}
            className={cx(
              "flex min-h-11 shrink-0 cursor-pointer items-center border-0 bg-transparent px-3 type-menu whitespace-nowrap",
              filter === value ? "text-action-secondary shadow-[inset_0_-2px_0_var(--color-action-secondary)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="data-table">
        <div className="data-table__scroll">
          <table>
            <caption className="sr-only">Schedules</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">With</th>
                <th scope="col" className="data-table__nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="data-table__empty">
                    {filter === "all" ? (
                      <EmptyState compact title="Nothing scheduled yet" description="Meetings, task deadlines and demo calls show up here." />
                    ) : (
                      <EmptyState compact title={EMPTY[filter]} action={<Button type="button" variant="ghost" size="sm" onClick={() => setFilter("all")}>Show all</Button>} />
                    )}
                  </td>
                </tr>
              ) : (
                shown.map((row) => {
                  const at = when(row);
                  const whenCell = (
                    <>
                      <span className="block font-semibold text-ink">{at.title}</span>
                      <span className="block text-[0.8125rem] font-normal text-ink-muted">{at.subtitle}</span>
                    </>
                  );
                  return (
                    <tr key={row.key}>
                      <th scope="row">
                        {row.href ? (
                          <Link href={row.href} className="row-link">{whenCell}</Link>
                        ) : (
                          <button type="button" className="row-link" onClick={() => row.bookingId && onOpenBooking(row.bookingId)}>{whenCell}</button>
                        )}
                      </th>
                      <td><span className="block truncate">{row.title}</span></td>
                      <td>{SCHEDULE_KIND_LABELS[row.kind]}</td>
                      <td><span className="block truncate">{row.who}</span></td>
                      <td className="data-table__nowrap">
                        <Badge tone={row.status.tone} size="sm" dot>{row.status.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="m-0 type-body-sm text-ink-muted">{count}</p>
    </div>
  );
}
