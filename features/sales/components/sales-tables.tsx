import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { SalesMonth, SalesPayment } from "../contract";

// Cents, not rounded to dollars: these are accounting figures.
export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const monthLabel = (month: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const figure = (value: string) => <span className="block text-right tabular-nums">{value}</span>;

const monthColumns: Column<SalesMonth>[] = [
  { key: "month", label: "Month", render: (row) => monthLabel(row.month) },
  { key: "payments", label: "Payments", render: (row) => figure(String(row.payments)) },
  { key: "gross", label: "Gross", render: (row) => figure(money(row.grossCents)) },
  { key: "fees", label: "Fees", render: (row) => figure(money(row.feeCents)) },
  { key: "net", label: "Net", render: (row) => <span className="block text-right font-semibold tabular-nums">{money(row.netCents)}</span> },
];

/** Gross, fees and net per month, newest first. */
export function SalesByMonth({ months }: { months: readonly SalesMonth[] }) {
  return <DataTable caption="Sales by month" columns={monthColumns} rows={months} rowKey={(row) => row.month} keepHeader empty={null} />;
}

const paymentColumns: Column<SalesPayment>[] = [
  { key: "client", label: "Client", render: (row) => <CellTitle title={row.companyName} subtitle={row.reference ?? undefined} /> },
  { key: "date", label: "Received", render: (row) => <span className="whitespace-nowrap">{day.format(new Date(`${row.paidOn}T00:00:00Z`))}</span> },
  { key: "amount", label: "Amount", render: (row) => figure(money(row.amountCents)) },
  { key: "fee", label: "Fee", render: (row) => figure(money(row.feeCents)) },
];

/** The latest payments recorded, with the client and the bank reference. */
export function RecentPayments({ payments }: { payments: readonly SalesPayment[] }) {
  return (
    <DataTable
      caption="Recent payments"
      columns={paymentColumns}
      rows={payments}
      rowKey={(row) => row.id}
      keepHeader
      empty={<EmptyState compact title="No payments yet" description="Payments appear here when an admin confirms a registration and records what was received." />}
    />
  );
}
