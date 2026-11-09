import { describe, expect, it } from "vitest";
import { amountDue, packages, paidUpfront, termSavings } from "./packages";

describe("term billing", () => {
  it("bills Monthly each month and takes 6 and 12 months upfront", () => {
    expect(paidUpfront(1)).toBe(false);
    expect(paidUpfront(6)).toBe(true);
    expect(paidUpfront(12)).toBe(true);
  });

  it("charges one month for Monthly and the whole term at the lower rate otherwise", () => {
    expect(amountDue(90000, 1)).toBe(90000);
    expect(amountDue(85500, 6)).toBe(513000);
    expect(amountDue(144000, 12)).toBe(1728000);
  });

  it("every package's upfront total is the discounted rate times the term", () => {
    for (const pkg of packages) {
      expect(amountDue(pkg.monthlyPrice[6], 6)).toBe(pkg.monthlyPrice[6] * 6);
      expect(amountDue(pkg.monthlyPrice[12], 12)).toBeLessThan(pkg.monthlyPrice[1] * 12);
    }
  });

  it("saves the difference from month to month, per month and over the term", () => {
    expect(termSavings("essentials", 85500, 6)).toEqual({ perMonth: 4500, total: 27000 });
    expect(termSavings("day-and-night", 270000, 12)).toEqual({ perMonth: 30000, total: 360000 });
  });

  it("saves nothing on Monthly, an unknown package or a rate above month to month", () => {
    expect(termSavings("essentials", 90000, 1)).toEqual({ perMonth: 0, total: 0 });
    expect(termSavings("unknown", 85500, 6)).toEqual({ perMonth: 0, total: 0 });
    expect(termSavings(null, 85500, 6)).toEqual({ perMonth: 0, total: 0 });
    expect(termSavings("essentials", 95000, 6)).toEqual({ perMonth: 0, total: 0 });
  });
});
