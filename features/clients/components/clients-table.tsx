import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { adminClientHref } from "@/content/routes";
import { CLIENT_STATUS_LABELS, type ClientStatus, type ClientSummary } from "../contract";

const created = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

// Pending = waiting on onboarding (a decision is due), active = done, inactive = no action needed.
const TONES: Record<ClientStatus, BadgeTone> = { pending: "warning", active: "success", inactive: "neutral" };

/** Long values stay on one line; the cell clips them and the title shows the rest on hover. */
function clipped(value: string) {
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}

const COLUMNS: Column<ClientSummary>[] = [
  {
    key: "company",
    label: "Company",
    render: (client) => (
      <Link href={adminClientHref(client.id)} className="staff-row-link" title={client.companyName}>
        {client.companyName}
      </Link>
    ),
  },
  { key: "contact", label: "Contact", render: (client) => clipped(client.contactName) },
  { key: "email", label: "Email Address", render: (client) => clipped(client.contactEmail) },
  { key: "createdBy", label: "Created by", render: (client) => clipped(client.createdBy) },
  {
    key: "status",
    label: "Status",
    render: (client) =>
      client.disabledAt ? (
        <Badge tone="neutral" size="sm" dot>
          Disabled
        </Badge>
      ) : (
        <Badge tone={TONES[client.status]} size="sm" dot={TONES[client.status] === "neutral"}>
          {CLIENT_STATUS_LABELS[client.status]}
        </Badge>
      ),
  },
  { key: "created", label: "Created", render: (client) => <span className="whitespace-nowrap text-ink-muted">{created.format(new Date(client.createdAt))}</span> },
];

/** Admin client list. The company opens the profile, where registration progress lives. */
export function ClientsTable({ clients, empty, keepHeader = false }: { clients: readonly ClientSummary[]; empty: ReactNode; keepHeader?: boolean }) {
  return <DataTable caption="Clients" columns={COLUMNS} rows={clients} rowKey={(client) => client.id} keepHeader={keepHeader} empty={empty} />;
}
