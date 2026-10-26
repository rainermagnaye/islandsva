// The sales summary: payments received (recorded by an admin when confirming a registration), totalled per
// month. Gross = amounts received; fees = bank or transfer fees taken out; net = gross − fees. Monthly recurring
// revenue is the agreed monthly price of every active client. No Zod, safe for client imports.

export type SalesPayment = { id: string; clientId: string; companyName: string; amountCents: number; feeCents: number; paidOn: string; reference: string | null };

export type SalesMonth = { month: string; payments: number; grossCents: number; feeCents: number; netCents: number };

/** The last `count` calendar months ("2026-10", "2026-09", …), newest first, ending at `today`'s month (UTC). */
export function lastMonths(count: number, today = new Date()): string[] {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - i, 1));
    return date.toISOString().slice(0, 7);
  });
}

/** Totals per month, newest first; months without payments show zeros so the table has no gaps. */
export function summarizeByMonth(payments: readonly Pick<SalesPayment, "amountCents" | "feeCents" | "paidOn">[], months: readonly string[]): SalesMonth[] {
  const rows = new Map(months.map((month) => [month, { month, payments: 0, grossCents: 0, feeCents: 0, netCents: 0 }]));
  for (const payment of payments) {
    const row = rows.get(payment.paidOn.slice(0, 7));
    if (!row) continue;
    row.payments += 1;
    row.grossCents += payment.amountCents;
    row.feeCents += payment.feeCents;
    row.netCents += payment.amountCents - payment.feeCents;
  }
  return [...rows.values()];
}

/** The sum of every row, for the table's footer and the year's cards. */
export function totalOf(months: readonly SalesMonth[]) {
  return months.reduce((sum, row) => ({ payments: sum.payments + row.payments, grossCents: sum.grossCents + row.grossCents, feeCents: sum.feeCents + row.feeCents, netCents: sum.netCents + row.netCents }), { payments: 0, grossCents: 0, feeCents: 0, netCents: 0 });
}
