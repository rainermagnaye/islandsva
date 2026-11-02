import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./countries";
import { callTimeLines, timezoneForCountry } from "./timezones";

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

describe("callTimeLines", () => {
  const startsAt = "2026-11-10T01:30:00.000Z";

  it("shows the visitor's clock, then Philippine time", () => {
    expect(callTimeLines("United States", startsAt)).toEqual(["Nov 9, 2026, 8:30 PM New York", "Nov 10, 2026, 9:30 AM PHT"]);
  });

  it("shows Philippine time alone for the Philippines or an unknown country", () => {
    expect(callTimeLines("Philippines", startsAt)).toEqual(["Nov 10, 2026, 9:30 AM PHT"]);
    expect(callTimeLines("Atlantis", startsAt)).toEqual(["Nov 10, 2026, 9:30 AM PHT"]);
    expect(callTimeLines(null, startsAt)).toEqual(["Nov 10, 2026, 9:30 AM PHT"]);
  });
});
