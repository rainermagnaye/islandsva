import { describe, expect, it } from "vitest";
import { parseDiscoveryTimes } from "./validation";

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
