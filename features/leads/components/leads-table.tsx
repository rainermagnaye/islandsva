import Link from "next/link";
import type { ReactNode } from "react";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { adminLeadHref } from "@/content/routes";
import { isConvertible, type LeadSummary } from "../contract";
import { ConvertLeadButton } from "./convert-lead-button";
import { LeadStatusBadge, packageName } from "./lead-status";

const received = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const COLUMNS: Column<LeadSummary>[] = [
  {
    key: "name",
    label: "Name",
    render: (lead) => <CellTitle title={<Link href={adminLeadHref(lead.id)}>{lead.fullName}</Link>} subtitle={lead.email} />,
  },
  { key: "company", label: "Company", render: (lead) => lead.companyName ?? "—" },
  { key: "package", label: "Package", render: (lead) => packageName(lead.packageCode) },
  { key: "status", label: "Status", render: (lead) => <LeadStatusBadge status={lead.status} /> },
  { key: "received", label: "Received", render: (lead) => <span className="whitespace-nowrap text-ink-muted">{received.format(new Date(lead.createdAt))}</span> },
  {
    key: "actions",
    label: "Actions",
    hideLabel: true,
    align: "end",
    // Only rows that can still become a client get Convert.
    render: (lead) =>
      isConvertible(lead.status) && <ConvertLeadButton lead={{ id: lead.id, fullName: lead.fullName, companyName: lead.companyName }} />,
  },
];

/** Admin lead list. `empty` replaces the table when there are no rows (defaults to the first-use message). */
export function LeadsTable({ leads, caption = "Contact-form leads", empty }: { leads: readonly LeadSummary[]; caption?: string; empty?: ReactNode }) {
  return (
    <DataTable
      caption={caption}
      columns={COLUMNS}
      rows={leads}
      rowKey={(lead) => lead.id}
      empty={empty ?? <EmptyState compact title="No leads yet" description="They appear here as soon as someone sends the contact form." />}
    />
  );
}
