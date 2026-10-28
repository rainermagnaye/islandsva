"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
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
 * a task opens the task, a demo call VA Match.
 */
export function ScheduleTable({ rows, onOpenBooking }: { rows: readonly ScheduleRow[]; onOpenBooking: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? rows : rows.filter((row) => row.kind === filter);
  const count = shown.length === 1 ? "1 item" : `${shown.length} items`;
  const columns: Column<ScheduleRow>[] = [
    {
      key: "when",
      label: "When",
      render: (row) => {
        const at = when(row);
        const cell = <CellTitle title={at.title} subtitle={at.subtitle} />;
        return row.href ? (
          <Link href={row.href} className="row-link">{cell}</Link>
        ) : (
          <button type="button" className="row-link" onClick={() => row.bookingId && onOpenBooking(row.bookingId)}>{cell}</button>
        );
      },
    },
    { key: "title", label: "Title", render: (row) => <span className="block truncate">{row.title}</span> },
    { key: "type", label: "Type", nowrap: true, render: (row) => SCHEDULE_KIND_LABELS[row.kind] },
    { key: "with", label: "With", render: (row) => <span className="block truncate">{row.who}</span> },
    {
      key: "status",
      label: "Status",
      nowrap: true,
      render: (row) => <Badge tone={row.status.tone} size="sm" dot>{row.status.label}</Badge>,
    },
  ];

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
      <DataTable
        caption="Schedules"
        columns={columns}
        rows={shown}
        rowKey={(row) => row.key}
        rowLabel={(row) => row.title}
        keepHeader
        empty={
          filter === "all" ? (
            <EmptyState compact title="Nothing scheduled yet" description="Meetings, task deadlines and demo calls show up here." />
          ) : (
            <EmptyState compact title={EMPTY[filter]} action={<Button type="button" variant="ghost" size="sm" onClick={() => setFilter("all")}>Show all</Button>} />
          )
        }
      />
      <p className="m-0 type-body-sm text-ink-muted">{count}</p>
    </div>
  );
}
