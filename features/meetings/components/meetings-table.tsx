"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";
import { BOOKING_STATUS_LABELS, BOOKING_TIME_ZONE, type Booking, type BookingStatus } from "../contract";

const FILTERS = [["all", "All"], ["requested", "Requested"], ["scheduled", "Scheduled"], ["done", "Completed"], ["cancelled", "Cancelled"]] as const;
type Filter = (typeof FILTERS)[number][0];

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: BOOKING_TIME_ZONE });
const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: BOOKING_TIME_ZONE });

function names(booking: Booking, kind: "client" | "staff") {
  const invited = booking.guests.filter((guest) => guest.kind === kind).map((guest) => guest.name);
  if (invited.length > 0) return invited.join(", ");
  return (kind === "client" ? booking.clientName : booking.staffName) ?? "—";
}

function when(booking: Booking) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const sameDay = day.format(start) === day.format(end);
  return {
    title: day.format(start),
    subtitle: sameDay ? `${time.format(start)} – ${time.format(end)}` : `${time.format(start)} – ${day.format(end)}, ${time.format(end)}`,
  };
}

/** The meetings on the admin calendar, newest start first. A row opens that meeting. */
export function MeetingsTable({ bookings, onOpen }: { bookings: readonly Booking[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = filter === "all" ? bookings : bookings.filter((booking) => booking.status === filter);
  const count = rows.length === 1 ? "1 meeting" : `${rows.length} meetings`;
  const columns: Column<Booking>[] = [
    {
      key: "when",
      label: "When",
      render: (booking) => {
        const at = when(booking);
        return (
          <button type="button" className="row-link" onClick={() => onOpen(booking.id)}>
            <CellTitle title={at.title} subtitle={at.subtitle} />
          </button>
        );
      },
    },
    { key: "title", label: "Meeting", render: (booking) => <span className="block truncate">{booking.title}</span> },
    { key: "client", label: "Client", render: (booking) => <span className="block truncate">{names(booking, "client")}</span> },
    { key: "staff", label: "Staff", render: (booking) => <span className="block truncate">{names(booking, "staff")}</span> },
    {
      key: "status",
      label: "Status",
      nowrap: true,
      render: (booking) => (
        <Badge tone={booking.status === "done" ? "info" : booking.status === "scheduled" ? "success" : booking.status === "requested" ? "warning" : "neutral"} size="sm" dot>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <h2 className="m-0 type-h2">Meetings</h2>
      <nav aria-label="Filter meetings by status" className="flex gap-1 overflow-x-auto border-b border-border">
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
        caption="Meetings"
        columns={columns}
        rows={rows}
        rowKey={(booking) => booking.id}
        rowLabel={(booking) => booking.title}
        keepHeader
        empty={
          filter === "all" ? (
            <EmptyState compact title="No meetings yet" description="Meetings you add on the calendar show up here." />
          ) : (
            <EmptyState
              compact
              title={`No ${BOOKING_STATUS_LABELS[filter as BookingStatus].toLowerCase()} meetings`}
              action={<Button type="button" variant="ghost" size="sm" onClick={() => setFilter("all")}>Show all</Button>}
            />
          )
        }
      />
      <p className="m-0 type-body-sm text-ink-muted">{count}</p>
    </div>
  );
}
