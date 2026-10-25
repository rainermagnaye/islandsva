import { describe, expect, it } from "vitest";
import { SLOT_TIMES, bookableTimes, demoState, formatInZone, manilaDate, manilaToIso } from "./contract";
import { parseBooking, parseBookingId, parseDecision, parseNewSlots, parseSlotId } from "./validation";

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

describe("booking", () => {
  const SLOT = "5d2f1c7e-8a4b-4c3d-9e1f-2a3b4c5d6e7f";
  it("takes a slot and an optional, trimmed note", () => {
    expect(parseBooking({ slotId: SLOT, note: "  Inbox first  " })).toEqual({ ok: true, value: { slotId: SLOT, note: "Inbox first" } });
    expect(parseBooking({ slotId: SLOT, note: "   " })).toEqual({ ok: true, value: { slotId: SLOT, note: null } });
    expect(parseBooking({ slotId: SLOT })).toEqual({ ok: true, value: { slotId: SLOT, note: null } });
  });

  it("asks for a time, and keeps the note within the limit", () => {
    expect(parseBooking({ note: "" })).toMatchObject({ fieldErrors: { slotId: "Pick a time." } });
    expect(parseBooking({ slotId: SLOT, note: "x".repeat(501) })).toMatchObject({ fieldErrors: { note: expect.stringContaining("500") } });
    expect(parseBooking({ slotId: SLOT, clientId: SLOT })).toEqual({ ok: false, formError: expect.any(String) });
  });

  it("takes a VA's decision with an optional reason", () => {
    expect(parseDecision({ bookingId: SLOT, decision: "rejected", reason: " Away that week " })).toEqual({ ok: true, value: { bookingId: SLOT, decision: "rejected", reason: "Away that week" } });
    expect(parseDecision({ bookingId: SLOT, decision: "confirmed" })).toEqual({ ok: true, value: { bookingId: SLOT, decision: "confirmed", reason: null } });
    expect(parseDecision({ bookingId: SLOT, decision: "maybe" })).toEqual({ ok: false, formError: expect.any(String) });
    expect(parseDecision({ bookingId: SLOT, decision: "rejected", reason: "x".repeat(301) })).toMatchObject({ fieldErrors: { reason: expect.stringContaining("300") } });
    expect(parseBookingId({ bookingId: "x" })).toEqual({ ok: false, formError: expect.any(String) });
  });

  it("offers one slot per time, the first one offered", () => {
    expect(bookableTimes([{ id: "a", startsAt: "t1" }, { id: "b", startsAt: "t1" }, { id: "c", startsAt: "t2" }])).toEqual([
      { slotId: "a", startsAt: "t1" },
      { slotId: "c", startsAt: "t2" },
    ]);
  });

  it("formats a time in the reader's zone, falling back to UTC for an unknown zone", () => {
    expect(formatInZone("2026-11-03T14:30:00.000Z", "America/New_York")).toBe("Tue, Nov 3, 9:30 AM EST");
    expect(formatInZone("2026-11-03T14:30:00.000Z", "Asia/Manila")).toBe("Tue, Nov 3, 10:30 PM GMT+8");
    expect(formatInZone("2026-11-03T14:30:00.000Z", "Not/AZone")).toBe("Tue, Nov 3, 2:30 PM UTC");
  });
});
