import { describe, expect, it } from "vitest";
import { currencyForCountry, formatPackagePrice } from "./currencies";

describe("package currency", () => {
  it("uses the country's currency and keeps US dollars for the United States", () => {
    expect(currencyForCountry("Philippines")).toBe("PHP");
    expect(currencyForCountry("Australia")).toBe("AUD");
    expect(currencyForCountry("United States")).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
    expect(formatPackagePrice(160000, "United States")).toBe("USD\u00a01,600");
    expect(formatPackagePrice(270000, "Australia")).toBe("AUD\u00a02,700");
    expect(formatPackagePrice(160000, "Philippines")).toBe("PHP\u00a01,600");
  });
});
