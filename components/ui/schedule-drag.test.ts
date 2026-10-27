import { describe, expect, it } from "vitest";
import { atMinutes, placeEvent, shiftDay, spanMinutes } from "./schedule-drag";

const limits = { snap: 15, minLength: 15, maxLength: 8 * 60, dayStart: 0, dayEnd: 24 * 60 };

describe("placeEvent", () => {
  it("moves a meeting to the nearest quarter hour and keeps its length", () => {
    expect(placeEvent({ start: 9 * 60, end: 10 * 60 }, 10 * 60 + 20, { ...limits, mode: "move" })).toEqual({ start: 10 * 60 + 15, end: 11 * 60 + 15 });
  });

  it("stretches the end and will not pass 8 hours or shrink under the minimum", () => {
    expect(placeEvent({ start: 9 * 60, end: 10 * 60 }, 12 * 60, { ...limits, mode: "resize" })).toEqual({ start: 9 * 60, end: 12 * 60 });
    expect(placeEvent({ start: 9 * 60, end: 10 * 60 }, 9 * 60, { ...limits, mode: "resize" })).toEqual({ start: 9 * 60, end: 9 * 60 + 15 });
    expect(placeEvent({ start: 9 * 60, end: 10 * 60 }, 20 * 60, { ...limits, mode: "resize" })).toEqual({ start: 9 * 60, end: 17 * 60 });
  });

  it("keeps a moved meeting on the visible day", () => {
    expect(placeEvent({ start: 9 * 60, end: 10 * 60 }, -30, { ...limits, mode: "move" }).start).toBe(0);
    expect(placeEvent({ start: 22 * 60, end: 23 * 60 }, 24 * 60, { ...limits, mode: "move" }).start).toBe(24 * 60 - 15);
  });
});

describe("clocks", () => {
  it("counts a meeting that ends the next morning", () => {
    expect(spanMinutes("2026-10-27T22:00", "2026-10-28T01:00")).toBe(3 * 60);
  });

  it("writes 25:00 as 01:00 the next day", () => {
    expect(atMinutes("2026-10-27", 25 * 60)).toBe("2026-10-28T01:00");
  });

  it("keeps the clock when the meeting moves to another day", () => {
    expect(shiftDay("2026-10-27T09:30", "2026-10-27", "2026-10-29")).toBe("2026-10-29T09:30");
    expect(shiftDay("2026-10-28T01:00", "2026-10-27", "2026-10-29")).toBe("2026-10-30T01:00");
  });
});
