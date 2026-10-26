import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel, cardSurface } from "@/components/ui/card";
import { RecentPayments, SalesByMonth, money } from "@/features/sales/components/sales-tables";
import { lastMonths, summarizeByMonth, totalOf } from "@/features/sales/contract";
import { listPaymentsSince, recurringRevenue } from "@/features/sales/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sales" };

const MONTHS = 12;
const RECENT = 10;

export default function AdminSalesPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminSales />
    </Suspense>
  );
}

/** One headline figure in money (StatCard formats whole numbers). */
function Figure({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <section aria-label={label} className={`${cardSurface} grid min-w-0 content-start gap-2 p-5`}>
      <p className="m-0 type-label text-ink-muted">{label}</p>
      <p className="m-0 type-stat text-ink tabular-nums">{value}</p>
      <p className="m-0 type-body-sm text-ink-muted">{caption}</p>
    </section>
  );
}

async function AdminSales() {
  await requireRole(["admin"]);
  const months = lastMonths(MONTHS);
  const since = `${months[months.length - 1]}-01`;
  // Independent reads, in parallel; both run as the signed-in admin, so RLS applies too.
  const [payments, recurring] = await Promise.all([listPaymentsSince(since), recurringRevenue()]);
  const byMonth = summarizeByMonth(payments, months);
  const [thisMonth] = byMonth;
  const year = totalOf(byMonth);

  return (
    <Workspace title="Sales" lead="Payments received, as recorded when registrations are confirmed. Net is gross minus bank or transfer fees.">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Gross this month" value={money(thisMonth.grossCents)} caption={`${thisMonth.payments} payment${thisMonth.payments === 1 ? "" : "s"}`} />
        <Figure label="Net this month" value={money(thisMonth.netCents)} caption={`After ${money(thisMonth.feeCents)} in fees`} />
        <Figure label="Last 12 months" value={money(year.netCents)} caption={`Net, from ${money(year.grossCents)} gross`} />
        <Figure label="Monthly recurring revenue" value={money(recurring.cents)} caption={`Agreed price of ${recurring.clients} active client${recurring.clients === 1 ? "" : "s"}`} />
      </section>
      <Panel title="By month">
        <SalesByMonth months={byMonth} />
      </Panel>
      <Panel title="Recent payments">
        <RecentPayments payments={payments.slice(0, RECENT)} />
      </Panel>
    </Workspace>
  );
}
