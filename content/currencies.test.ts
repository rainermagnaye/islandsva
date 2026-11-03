import { describe, expect, it } from "vitest";
import { convertFromUsd, currencyForCountry, formatLocalPrice, formatPackagePrice } from "./currencies";
import { monthlyPriceFor } from "./packages";

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
    expect(convertFromUsd(156000, "PHP")).toBe(Math.round(156000 * 63.306));
    expect(formatPackagePrice(156000, "United States")).toBe("USD\u00a01,560");
    expect(formatLocalPrice(156000, "Philippines")).toBe("PHP\u00a098,757");
    expect(formatPackagePrice(156000, "Philippines")).toBe("PHP\u00a098,757 (USD\u00a01,560)");
  });
});

describe("package prices at $9 an hour", () => {
  it("prices a month as 52/12 weeks and takes 5% or 10% off longer terms", () => {
    expect([monthlyPriceFor(20, 1), monthlyPriceFor(40, 1), monthlyPriceFor(80, 1)]).toEqual([78000, 156000, 312000]);
    expect([monthlyPriceFor(20, 6), monthlyPriceFor(40, 6), monthlyPriceFor(80, 6)]).toEqual([74100, 148200, 296400]);
    expect([monthlyPriceFor(20, 12), monthlyPriceFor(40, 12), monthlyPriceFor(80, 12)]).toEqual([70200, 140400, 280800]);
  });
});
