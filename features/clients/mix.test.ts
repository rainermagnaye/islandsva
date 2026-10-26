import { describe, expect, it } from "vitest";
import { packageMix } from "./mix";

const names = { essentials: "Essentials", executive: "Executive" };

describe("package mix", () => {
  it("sums clients that share a package and keeps an unknown code", () => {
    const rows = packageMix(
      [
        { packageCode: "essentials", monthlyCents: 85500 },
        { packageCode: "essentials", monthlyCents: 90000 },
        { packageCode: "custom", monthlyCents: 100 },
        { packageCode: null, monthlyCents: 50 },
      ],
      names,
    );
    expect(rows).toEqual([
      { code: "custom", label: "custom", count: 1, monthlyCents: 100 },
      { code: "essentials", label: "Essentials", count: 2, monthlyCents: 175500 },
      { code: null, label: "No package", count: 1, monthlyCents: 50 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.monthlyCents, 0)).toBe(175650);
  });

  it("treats a missing price as zero and returns nothing for an empty list", () => {
    expect(packageMix([{ packageCode: "executive", monthlyCents: null }], names)).toEqual([
      { code: "executive", label: "Executive", count: 1, monthlyCents: 0 },
    ]);
    expect(packageMix([], names)).toEqual([]);
  });
});
