"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ShortlistAdmin } from "@/features/matching/components/shortlist-admin";
import type { ShortlistEntry } from "@/features/matching/contract";
import type { TaskStatus } from "@/features/tasks/contract";
import { clientAssistantRows, packageBalanceLabel, type ClientAssistantRow } from "../assistants";

const STATUS_LABELS = { active: "Active", offered: "Offered" } as const;

const columns: Column<ClientAssistantRow>[] = [
  {
    key: "name",
    label: "Assistants",
    render: (row) =>
      row.href ? (
        <Link href={row.href} className="row-link" title={row.name}>
          {row.name}
        </Link>
      ) : (
        <span title={row.name}>{row.name}</span>
      ),
  },
  {
    key: "tasks",
    label: "Tasks",
    align: "end",
    nowrap: true,
    render: (row) => (
      <span className="tabular-nums">
        {row.closedTasks}/{row.totalTasks}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    nowrap: true,
    render: (row) => (
      <Badge tone={row.status === "active" ? "success" : "warning"} size="sm" dot>
        {STATUS_LABELS[row.status]}
      </Badge>
    ),
  },
  {
    key: "balance",
    label: "Package balance",
    align: "end",
    nowrap: true,
    render: (row) => packageBalanceLabel(row.hoursPerWeek),
  },
];

/** This client's assigned and offered VAs, then the offer form. Admins only. */
export function ClientAssistantsPanel({
  clientId,
  assignments,
  offers,
  vas,
  tasks,
  hoursPerWeek,
  hrefFor,
}: {
  clientId: string;
  assignments: readonly { id: string; vaId: string; vaName: string; startedAt: string }[];
  offers: readonly ShortlistEntry[];
  vas: readonly { id: string; fullName: string }[];
  tasks: readonly { vaId: string; status: TaskStatus }[];
  hoursPerWeek: number | null;
  hrefFor: (vaId: string) => string;
}) {
  const rows = clientAssistantRows({ assignments, offers, tasks, hoursPerWeek, hrefFor });

  return (
    <div className="grid gap-4">
      <DataTable
        caption="Assistants"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.vaId}
        rowLabel={(row) => row.name}
        selectable={false}
        empty={<EmptyState compact title="No assistants yet" description="Offer a VA below. They show here once offered or assigned." />}
      />
      <ShortlistAdmin clientId={clientId} assignments={assignments} offers={offers} vas={vas} />
    </div>
  );
}
