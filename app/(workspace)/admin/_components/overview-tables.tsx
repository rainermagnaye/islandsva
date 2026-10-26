import Link from "next/link";
import { cardSurface, Panel } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes } from "@/content/routes";
import type { PackageSlice } from "@/features/clients/mix";
import type { VaLoadRow } from "@/features/clients/load";
import { money } from "@/features/sales/contract";

const figure = (value: string) => <span className="block text-right tabular-nums">{value}</span>;

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

const packageColumns: Column<PackageSlice>[] = [
  { key: "package", label: "Package", render: (row) => row.label },
  { key: "clients", label: "Clients", align: "end", render: (row) => figure(String(row.count)) },
  { key: "monthly", label: "Monthly", align: "end", render: (row) => figure(money(row.monthlyCents)) },
];

/** How active clients split across packages, and the contracted total of each. */
export function PackageMix({ rows }: { rows: readonly PackageSlice[] }) {
  return (
    <Panel title="Packages">
      <DataTable
        caption="Package mix"
        columns={packageColumns}
        rows={rows}
        rowKey={(row) => row.code ?? "none"}
        selectable={false}
        empty={<EmptyState compact headingLevel={3} title="No active clients yet" description="Package totals appear when a client is active." />}
      />
    </Panel>
  );
}

const vaColumns: Column<VaLoadRow>[] = [
  { key: "va", label: "VA", render: (row) => row.firstName },
  { key: "clients", label: "Clients", align: "end", render: (row) => figure(String(row.clients)) },
  { key: "hours", label: "Hours / week", align: "end", render: (row) => figure(String(row.hoursPerWeek)) },
  { key: "done", label: "Tasks done", align: "end", render: (row) => figure(String(row.done)) },
  { key: "onTime", label: "On-time", align: "end", render: (row) => figure(rate(row.onTimeRate)) },
  { key: "overdue", label: "Overdue", align: "end", render: (row) => figure(String(row.overdue)) },
];

/** Open VAs, the clients they carry, and their task figures. A blank on-time rate means nothing is done yet. */
export function VaLoad({ rows }: { rows: readonly VaLoadRow[] }) {
  return (
    <Panel title="VA load">
      <DataTable
        caption="VA load"
        columns={vaColumns}
        rows={rows}
        rowKey={(row) => row.vaId}
        selectable={false}
        empty={<EmptyState compact headingLevel={3} title="No open VAs" description="VAs appear here once their portal is open." />}
      />
    </Panel>
  );
}

/** The sales figure, linked through to the sales page. StatCard only formats whole numbers. */
export function RevenueCard({ cents }: { cents: number }) {
  return (
    <Link href={appRoutes.adminSales} className={`${cardSurface} grid min-w-0 content-start gap-2 p-5 text-ink no-underline transition-colors hover:border-border-strong hover:elevation-sm`}>
      <p className="m-0 type-label text-ink-muted">Contracted revenue</p>
      <p className="m-0 type-stat text-ink tabular-nums">{money(cents)}</p>
      <p className="m-0 type-body-sm text-ink-muted">Agreed monthly price of active clients</p>
    </Link>
  );
}
