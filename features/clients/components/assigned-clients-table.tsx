import type { ReactNode } from "react";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import type { AssignedClient } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const columns: Column<AssignedClient>[] = [
  { key: "company", label: "Company", render: (client) => <CellTitle title={client.companyName} subtitle={client.contactName} /> },
  {
    key: "email",
    label: "Email Address",
    render: (client) => (
      <a href={`mailto:${client.contactEmail}`} className="block truncate" title={client.contactEmail}>
        {client.contactEmail}
      </a>
    ),
  },
  { key: "timezone", label: "Time zone", render: (client) => client.timezone ?? "—" },
  { key: "hours", label: "Hours", render: (client) => (client.hoursPerWeek ? `${client.hoursPerWeek} h/week` : "—") },
  { key: "since", label: "Since", render: (client) => <span className="whitespace-nowrap text-ink-muted">{day.format(new Date(client.startedAt))}</span> },
];

/** The VA's clients: who, how to reach them, their time zone and agreed hours. Server-rendered. */
export function AssignedClientsTable({ clients, caption, empty }: { clients: readonly AssignedClient[]; caption: string; empty: ReactNode }) {
  return <DataTable caption={caption} columns={columns} rows={clients} rowKey={(client) => client.id} empty={empty} />;
}
