import { describe, expect, it } from "vitest";
import { parseBooking, parseDiscoveryTimes } from "./validation";

describe("parseDiscoveryTimes", () => {
  it("accepts none to six half-hour times and returns them in order", () => {
    expect(parseDiscoveryTimes({ times: [] })).toEqual({ ok: true, value: { times: [] } });
    expect(parseDiscoveryTimes({ times: ["21:00", "09:30", "00:00", "13:00", "17:30", "23:30"] })).toEqual({
      ok: true,
      value: { times: ["00:00", "09:30", "13:00", "17:30", "21:00", "23:30"] },
    });
  });

  it("drops empty values", () => {
    expect(parseDiscoveryTimes({ times: ["", "09:00", ""] })).toEqual({ ok: true, value: { times: ["09:00"] } });
  });

  it("refuses a seventh time and a repeated one", () => {
    const seven = ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00"];
    expect(parseDiscoveryTimes({ times: seven })).toMatchObject({ ok: false, fieldErrors: { times: "Choose at most 6 times." } });
    expect(parseDiscoveryTimes({ times: ["09:00", "09:00"] })).toMatchObject({ ok: false, fieldErrors: { times: "Choose each time once." } });
  });

  it.each(["09:15", "24:00", "9:00", "09:00:00", "noon"])("refuses %s", (time) => {
    expect(parseDiscoveryTimes({ times: [time] })).toMatchObject({ ok: false, fieldErrors: { times: "Choose times on the hour or half hour." } });
  });

  it("refuses values that aren't strings, a missing list and unknown fields", () => {
    expect(parseDiscoveryTimes({ times: [900] })).toMatchObject({ ok: false });
    expect(parseDiscoveryTimes({ times: [new File(["x"], "x.txt")] })).toMatchObject({ ok: false });
    expect(parseDiscoveryTimes({})).toMatchObject({ ok: false });
    expect(parseDiscoveryTimes({ times: ["09:00"], tenant: "x" })).toEqual({ ok: false, formError: expect.any(String) });
    expect(parseDiscoveryTimes(null)).toEqual({ ok: false, formError: expect.any(String) });
  });
});

const booking = {
  title: "Weekly check-in",
  startDate: "2026-11-03",
  startTime: "09:00",
  endDate: "2026-11-03",
  endTime: "10:00",
  clientIds: [],
  staffIds: [],
  note: "",
};

describe("parseBooking", () => {
  it("accepts a title and a Manila span of at most 8 hours", () => {
    const parsed = parseBooking(booking);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.clientIds).toEqual([]);
  });

  it("refuses an end that is not after the start", () => {
    const parsed = parseBooking({ ...booking, endTime: "09:00" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && "fieldErrors" in parsed) expect(parsed.fieldErrors.endTime).toMatch(/8 hours/);
  });

  it("refuses a span longer than 8 hours", () => {
    const parsed = parseBooking({ ...booking, endTime: "18:00" });
    expect(parsed.ok).toBe(false);
  });

  it("refuses a blank title", () => {
    const parsed = parseBooking({ ...booking, title: "  " });
    expect(parsed.ok).toBe(false);
  });
});
