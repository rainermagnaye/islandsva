import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { adminClientHref } from "@/content/routes";
import { clientBadge, type ClientSummary } from "../contract";

const created = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Long values stay on one line; the cell clips them and the title shows the rest on hover. */
function clipped(value: string) {
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}

const columns = (hrefFor: (id: string) => string): Column<ClientSummary>[] => [
  {
    key: "company",
    label: "Company",
    render: (client) => (
      <Link href={hrefFor(client.id)} className="staff-row-link" title={client.companyName}>
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
    nowrap: true,
    render: (client) => {
      const badge = clientBadge(client);
      return (
        <Badge tone={badge.tone} size="sm" dot={badge.dot}>
          {badge.label}
        </Badge>
      );
    },
  },
  { key: "created", label: "Created", render: (client) => <span className="whitespace-nowrap text-ink-muted">{created.format(new Date(client.createdAt))}</span> },
];

/** Client list. The company opens the profile (the admin's by default), where registration progress lives. */
export function ClientsTable({
  clients,
  empty,
  keepHeader = false,
  hrefFor = adminClientHref,
}: {
  clients: readonly ClientSummary[];
  empty: ReactNode;
  keepHeader?: boolean;
  hrefFor?: (id: string) => string;
}) {
  return (
    <DataTable
      caption="Clients"
      columns={columns(hrefFor)}
      rows={clients}
      rowKey={(client) => client.id}
      rowLabel={(client) => client.companyName}
      keepHeader={keepHeader}
      empty={empty}
    />
  );
}
