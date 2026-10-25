import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./countries";
import { timezoneForCountry } from "./timezones";

describe("country time zones", () => {
  it("gives every country one real time zone", () => {
    for (const name of COUNTRIES) {
      const zone = timezoneForCountry(name);
      expect(zone, name).not.toBeNull();
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone?.value }).format(0)).not.toThrow();
    }
    expect(timezoneForCountry("Australia")).toEqual({ value: "Australia/Sydney", label: "Australia — Sydney" });
    expect(timezoneForCountry("Philippines")).toEqual({ value: "Asia/Manila", label: "Philippines — Manila" });
    expect(timezoneForCountry("United States")?.value).toBe("America/New_York");
    expect(timezoneForCountry("")).toBeNull();
  });
});
