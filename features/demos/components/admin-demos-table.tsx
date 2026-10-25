import type { ReactNode } from "react";
import Link from "next/link";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { adminClientHref } from "@/content/routes";
import { VA_TIME_ZONE, demoState, formatInZone, type AdminDemo } from "../contract";
import { DemoStatusBadge } from "./demo-status-badge";

const booked = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const columns: Column<AdminDemo>[] = [
  {
    key: "when",
    label: "When",
    render: (demo) => <CellTitle title={formatInZone(demo.startsAt, demo.clientTimezone)} subtitle={`${formatInZone(demo.startsAt, VA_TIME_ZONE)} (VA)`} />,
  },
  {
    key: "company",
    label: "Client",
    render: (demo) => (
      <Link href={adminClientHref(demo.clientId)} className="staff-row-link" title={demo.companyName}>
        {demo.companyName}
      </Link>
    ),
  },
  { key: "va", label: "VA", render: (demo) => <span className="block truncate">{demo.vaName}</span> },
  { key: "status", label: "Status", render: (demo) => <DemoStatusBadge state={demoState(demo)} /> },
  { key: "booked", label: "Booked", render: (demo) => <span className="whitespace-nowrap text-ink-muted">{booked.format(new Date(demo.createdAt))}</span> },
];

/** Every demo call in the tenant: the client's time first (the VA's under it), who, and what it is now. */
export function AdminDemosTable({ demos, empty }: { demos: readonly AdminDemo[]; empty: ReactNode }) {
  return <DataTable caption="Demo calls" columns={columns} rows={demos} rowKey={(demo) => demo.id} keepHeader empty={empty} />;
}
