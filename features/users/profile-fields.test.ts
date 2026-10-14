import { describe, expect, it } from "vitest";
import { formatAddress, joinDuration, splitAddress, splitDuration } from "./profile-fields";

describe("address lines", () => {
  it("keeps street, city, province and postal code on their own lines", () => {
    expect(formatAddress("12 Shore", "Cebu", "Cebu", "6000")).toBe("12 Shore\nCebu\nCebu\n6000");
    expect(splitAddress("12 Shore\nCebu\nCebu\n6000")).toEqual({
      street: "12 Shore",
      city: "Cebu",
      province: "Cebu",
      postal: "6000",
    });
  });

  it("accepts one comma-separated line", () => {
    expect(splitAddress("12 Shore, Cebu, Cebu, 6000")).toEqual({
      street: "12 Shore",
      city: "Cebu",
      province: "Cebu",
      postal: "6000",
    });
  });
});

describe("work duration", () => {
  it("reads a date range and leaves older text alone", () => {
    expect(splitDuration("2019-01-01 – 2022-06-30")).toEqual({ start: "2019-01-01", end: "2022-06-30" });
    expect(splitDuration("2019–2022")).toEqual({ start: "", end: "" });
    expect(joinDuration("", "", "2019–2022")).toBe("2019–2022");
    expect(joinDuration("2019-01-01", "2022-06-30", "2019–2022")).toBe("2019-01-01 – 2022-06-30");
  });
});
