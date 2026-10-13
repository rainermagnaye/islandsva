import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { CLIENT_STATUS_LABELS, type ClientStatus, type ClientSummary } from "../contract";

const created = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

// Pending = waiting on onboarding (a decision is due), active = done, inactive = no action needed.
const TONES: Record<ClientStatus, BadgeTone> = { pending: "warning", active: "success", inactive: "neutral" };

const COLUMNS: Column<ClientSummary>[] = [
  { key: "company", label: "Company", render: (client) => client.companyName },
  { key: "contact", label: "Contact", render: (client) => <CellTitle title={client.contactName} subtitle={client.contactEmail} /> },
  {
    key: "status",
    label: "Status",
    render: (client) => (
      <Badge tone={TONES[client.status]} size="sm" dot={TONES[client.status] === "neutral"}>
        {CLIENT_STATUS_LABELS[client.status]}
      </Badge>
    ),
  },
  { key: "createdBy", label: "Created by", render: (client) => client.createdBy },
  { key: "created", label: "Created", render: (client) => <span className="whitespace-nowrap text-ink-muted">{created.format(new Date(client.createdAt))}</span> },
];

/** Admin client list. Read-only until onboarding (M3) adds activation and invites. */
export function ClientsTable({ clients, empty }: { clients: readonly ClientSummary[]; empty: ReactNode }) {
  return <DataTable caption="Clients" columns={COLUMNS} rows={clients} rowKey={(client) => client.id} empty={empty} />;
}
