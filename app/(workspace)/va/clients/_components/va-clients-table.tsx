import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { vaClientHref } from "@/content/routes";
import type { ClientRow } from "./client-rows";

const columns: Column<ClientRow>[] = [
  {
    key: "company",
    label: "Company",
    // The row link stretches across the whole row, so any cell opens the client's profile.
    render: (row) => (
      <CellTitle
        title={
          <Link href={vaClientHref(row.id)} className="row-link" title={row.company}>
            {row.company}
          </Link>
        }
        subtitle={row.contact}
      />
    ),
  },
  {
    key: "email",
    label: "Email Address",
    // Plain text: a link here would sit under the row link. The profile has the email button.
    render: (row) => (
      <span className="block truncate" title={row.email}>
        {row.email}
      </span>
    ),
  },
  {
    key: "time",
    label: "Their time now",
    render: (row) =>
      row.time ? (
        <>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Icon name={row.time.day ? "sun" : "moon"} size={16} className={row.time.day ? "text-shift-day-ink" : "text-shift-night-ink"} />
            {row.time.clock} · {row.time.city}
          </span>
          <span className="block type-caption text-ink-muted">{row.time.line}</span>
        </>
      ) : (
        <Badge tone="warning" size="sm">
          Time zone not set
        </Badge>
      ),
  },
  {
    key: "week",
    label: "Agreed",
    nowrap: true,
    render: (row) =>
      row.hoursPerWeek ? (
        <span className="tabular-nums">{row.hoursPerWeek} h a week</span>
      ) : (
        <Badge tone="neutral" size="sm">
          Hours not agreed
        </Badge>
      ),
  },
  {
    key: "work",
    label: "Open work",
    nowrap: true,
    render: (row) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge tone={row.open > 0 ? "info" : "neutral"} size="sm">
          {row.open > 0 ? `${row.open} open` : "None open"}
        </Badge>
        {row.overdue > 0 && (
          <Badge tone="danger" size="sm">
            {row.overdue} overdue
          </Badge>
        )}
      </span>
    ),
  },
  { key: "since", label: "Since", render: (row) => <span className="whitespace-nowrap text-ink-muted">{row.since}</span> },
];

/** The VA's clients in the shared records table: who, how to reach them, their time now, agreed hours, open work. */
export function VaClientsTable({ rows, empty }: { rows: readonly ClientRow[]; empty: ReactNode }) {
  return <DataTable caption="Your clients" columns={columns} rows={rows} rowKey={(row) => row.id} rowLabel={(row) => row.company} empty={empty} keepHeader />;
}
