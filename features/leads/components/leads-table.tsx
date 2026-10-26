import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { adminLeadHref } from "@/content/routes";
import type { LeadSummary } from "../contract";
import { LeadStatusBadge, packageName } from "./lead-status";

const received = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const nameColumn: Column<LeadSummary> = {
  key: "name",
  label: "Lead Name",
  render: (lead) => (
    <Link href={adminLeadHref(lead.id)} className="row-link" title={lead.fullName}>
      {lead.fullName}
    </Link>
  ),
};

/** Long values stay on one line; the cell clips them and the title shows the rest on hover. */
function clipped(value: string) {
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}

const LIST_COLUMNS: Column<LeadSummary>[] = [
  nameColumn,
  { key: "email", label: "Email Address", render: (lead) => clipped(lead.email) },
  { key: "company", label: "Company", render: (lead) => (lead.companyName ? clipped(lead.companyName) : "—") },
  { key: "closer", label: "Assigned Lead", render: (lead) => (lead.closerName ? clipped(lead.closerName) : "—") },
  { key: "status", label: "Status", nowrap: true, render: (lead) => <LeadStatusBadge status={lead.status} /> },
];

const SUMMARY_COLUMNS: Column<LeadSummary>[] = [
  nameColumn,
  { key: "company", label: "Company", render: (lead) => (lead.companyName ? clipped(lead.companyName) : "—") },
  { key: "package", label: "Package", render: (lead) => packageName(lead.packageCode) },
  { key: "status", label: "Status", nowrap: true, render: (lead) => <LeadStatusBadge status={lead.status} /> },
  { key: "received", label: "Received", render: (lead) => <span className="whitespace-nowrap text-ink-muted">{received.format(new Date(lead.createdAt))}</span> },
];

/** Admin lead list. `summary` is the short table on the overview; the lead page uses the full columns. */
export function LeadsTable({
  leads,
  caption = "Contact-form leads",
  empty,
  variant = "list",
  keepHeader = false,
}: {
  leads: readonly LeadSummary[];
  caption?: string;
  empty?: ReactNode;
  variant?: "list" | "summary";
  /** Show the column headers inside the rounded table even when there are no rows. */
  keepHeader?: boolean;
}) {
  return (
    <DataTable
      caption={caption}
      columns={variant === "summary" ? SUMMARY_COLUMNS : LIST_COLUMNS}
      rows={leads}
      rowKey={(lead) => lead.id}
      rowLabel={(lead) => lead.fullName}
      keepHeader={keepHeader}
      empty={empty ?? <EmptyState compact title="No leads yet" description="They appear here as soon as someone sends the discovery call form." />}
    />
  );
}
