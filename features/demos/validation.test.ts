import { describe, expect, it } from "vitest";
import { SLOT_TIMES, demoState, manilaDate, manilaToIso } from "./contract";
import { parseNewSlots, parseSlotId } from "./validation";

const NOW = new Date("2026-11-02T00:00:00Z"); // 08:00 on 2 November in Manila

describe("Manila times", () => {
  it("converts a Manila date and time to UTC, and back to the Manila date", () => {
    expect(manilaToIso("2026-11-03", "09:30")).toBe("2026-11-03T01:30:00.000Z");
    expect(manilaToIso("2026-11-03", "00:00")).toBe("2026-11-02T16:00:00.000Z");
    expect(manilaDate("2026-11-02T16:00:00.000Z")).toBe("2026-11-03");
    expect(manilaDate("2026-11-02T15:59:00.000Z")).toBe("2026-11-02");
  });

  it("offers every half hour of the day", () => {
    expect(SLOT_TIMES).toHaveLength(48);
    expect(SLOT_TIMES[0]).toBe("00:00");
    expect(SLOT_TIMES[47]).toBe("23:30");
  });
});

describe("parseNewSlots", () => {
  it("turns a date and times into sorted, de-duplicated UTC starts", () => {
    expect(parseNewSlots({ date: "2026-11-03", times: ["10:00", "09:30", "10:00"] }, NOW)).toEqual({
      ok: true,
      value: { startsAt: ["2026-11-03T01:30:00.000Z", "2026-11-03T02:00:00.000Z"] },
    });
  });

  it("asks for a date and at least one time", () => {
    expect(parseNewSlots({ date: "", times: [] }, NOW)).toEqual({ ok: false, fieldErrors: { date: "Choose a date.", times: "Pick at least one time." } });
    expect(parseNewSlots({ date: "2026-02-30", times: ["09:00"] }, NOW)).toMatchObject({ fieldErrors: { date: "Choose a date." } });
  });

  it("refuses past times and dates more than 30 days ahead", () => {
    expect(parseNewSlots({ date: "2026-11-02", times: ["07:30", "09:00"] }, NOW)).toMatchObject({ fieldErrors: { times: "Pick times that are still ahead." } });
    expect(parseNewSlots({ date: "2026-12-03", times: ["09:00"] }, NOW)).toMatchObject({ fieldErrors: { date: "Add slots up to 30 days ahead." } });
    expect(parseNewSlots({ date: "2026-12-02", times: ["07:30"] }, NOW)).toMatchObject({ ok: true });
  });

  it("treats a time that isn't on the half hour, or unknown keys, as a tampered form", () => {
    expect(parseNewSlots({ date: "2026-11-03", times: ["09:15"] }, NOW)).toMatchObject({ ok: false });
    expect(parseNewSlots({ date: "2026-11-03", times: ["09:00"], vaId: "x" }, NOW)).toEqual({ ok: false, formError: expect.any(String) });
    expect(parseSlotId({ slotId: "not-a-uuid" })).toEqual({ ok: false, formError: expect.any(String) });
  });
});

describe("demoState", () => {
  const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60 * 1000).toISOString();
  it("reads an unanswered request past its start as expired, and an ended confirmed demo as done", () => {
    expect(demoState({ status: "pending", startsAt: at(10), endsAt: at(40) }, NOW)).toBe("pending");
    expect(demoState({ status: "pending", startsAt: at(0), endsAt: at(30) }, NOW)).toBe("expired");
    expect(demoState({ status: "confirmed", startsAt: at(-20), endsAt: at(10) }, NOW)).toBe("confirmed");
    expect(demoState({ status: "confirmed", startsAt: at(-30), endsAt: at(0) }, NOW)).toBe("completed");
    expect(demoState({ status: "rejected", startsAt: at(-60), endsAt: at(-30) }, NOW)).toBe("rejected");
  });
});
