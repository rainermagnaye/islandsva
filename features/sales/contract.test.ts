import { describe, expect, it } from "vitest";
import { lastMonths, summarizeByMonth, totalOf } from "./contract";

describe("sales summary", () => {
  it("lists the last months newest first, across a year end", () => {
    expect(lastMonths(3, new Date("2026-01-15T00:00:00Z"))).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(lastMonths(1, new Date("2026-10-31T23:59:00Z"))).toEqual(["2026-10"]);
  });

  it("totals gross, fees and net per month, keeps empty months, and ignores payments outside the window", () => {
    const months = ["2026-10", "2026-09", "2026-08"];
    const rows = summarizeByMonth(
      [
        { amountCents: 85500, feeCents: 1500, paidOn: "2026-10-20" },
        { amountCents: 50000, feeCents: 0, paidOn: "2026-10-02" },
        { amountCents: 30000, feeCents: 300, paidOn: "2026-08-31" },
        { amountCents: 99999, feeCents: 0, paidOn: "2026-07-01" },
      ],
      months,
    );
    expect(rows).toEqual([
      { month: "2026-10", payments: 2, grossCents: 135500, feeCents: 1500, netCents: 134000 },
      { month: "2026-09", payments: 0, grossCents: 0, feeCents: 0, netCents: 0 },
      { month: "2026-08", payments: 1, grossCents: 30000, feeCents: 300, netCents: 29700 },
    ]);
    expect(totalOf(rows)).toEqual({ payments: 3, grossCents: 165500, feeCents: 1800, netCents: 163700 });
  });
});
