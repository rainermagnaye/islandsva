import { describe, expect, it } from "vitest";
import { joinDuration, splitDuration } from "./profile-fields";

describe("work duration", () => {
  it("reads a date range and leaves older text alone", () => {
    expect(splitDuration("2019-01-01 – 2022-06-30")).toEqual({ start: "2019-01-01", end: "2022-06-30" });
    expect(splitDuration("2019–2022")).toEqual({ start: "", end: "" });
    expect(joinDuration("", "", "2019–2022")).toBe("2019–2022");
    expect(joinDuration("2019-01-01", "2022-06-30", "2019–2022")).toBe("2019-01-01 – 2022-06-30");
  });
});
