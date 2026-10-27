import { describe, expect, it } from "vitest";
import { demoCalendarEvents, type DemoCalendarRow } from "./calendar";

const NOW = new Date("2026-11-02T00:00:00Z");

function row(overrides: Partial<DemoCalendarRow> = {}): DemoCalendarRow {
  return {
    id: "booking",
    clientId: "client",
    companyName: "Northwind",
    vaName: "Ana",
    status: "confirmed",
    startsAt: "2026-11-03T01:30:00.000Z",
    endsAt: "2026-11-03T02:00:00.000Z",
    ...overrides,
  };
}

describe("demo calendar events", () => {
  it("places a call on the Manila clock and colours it by what it is now", () => {
    expect(demoCalendarEvents([row()], NOW)).toEqual([
      { id: "booking", title: "Northwind", who: "Ana", start: "2026-11-03T09:30", end: "2026-11-03T10:00", tone: "lagoon" },
    ]);
    expect(demoCalendarEvents([row({ status: "pending", startsAt: "2026-11-01T01:30:00.000Z", endsAt: "2026-11-01T02:00:00.000Z" })], NOW)[0]?.tone).toBe("sand");
    expect(demoCalendarEvents([row({ status: "rejected" })], NOW)[0]?.tone).toBe("coral");
    expect(demoCalendarEvents([row({ status: "cancelled" })], NOW)[0]?.tone).toBe("ocean");
  });
});
