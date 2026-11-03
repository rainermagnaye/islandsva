import { describe, expect, it } from "vitest";
import { convertFromUsd, currencyForCountry, formatLocalPrice, formatPackagePrice } from "./currencies";

describe("package currency", () => {
  it("uses the country's currency and keeps US dollars for the United States", () => {
    expect(currencyForCountry("Philippines")).toBe("PHP");
    expect(currencyForCountry("Australia")).toBe("AUD");
    expect(currencyForCountry("United States")).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
    expect(currencyForCountry("Atlantis")).toBe("USD");
  });

  it("converts the US dollar price at the fixed rate and shows the USD amount beside it", () => {
    expect(convertFromUsd(100, "USD")).toBe(100);
    expect(convertFromUsd(160000, "PHP")).toBe(Math.round(160000 * 63.306));
    expect(formatPackagePrice(160000, "United States")).toBe("USD\u00a01,600");
    expect(formatLocalPrice(160000, "Philippines")).toBe("PHP\u00a0101,290");
    expect(formatPackagePrice(160000, "Philippines")).toBe("PHP\u00a0101,290 (USD\u00a01,600)");
  });
});

