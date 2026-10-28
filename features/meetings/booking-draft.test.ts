import { describe, expect, it } from "vitest";
import { clientGesture, draftFrom, draftOf, MANUAL_GESTURE, ownMeeting } from "./booking-draft";
import type { Booking } from "./contract";

describe("draftFrom", () => {
  it("makes a one-hour meeting from the clicked slot", () => {
    expect(draftFrom("2026-11-03", 9 * 60 + 30)).toEqual({ startDate: "2026-11-03", startTime: "09:30", endDate: "2026-11-03", endTime: "10:30" });
  });

  it("ends the next day when the slot is in the last hour", () => {
    expect(draftFrom("2026-11-03", 23 * 60 + 15)).toEqual({ startDate: "2026-11-03", startTime: "23:15", endDate: "2026-11-04", endTime: "00:15" });
  });
});

describe("draftOf", () => {
  it("shows a meeting's times in Philippine time", () => {
    expect(draftOf({ startsAt: "2026-11-03T01:00:00.000Z", endsAt: "2026-11-03T16:30:00.000Z" })).toEqual({
      startDate: "2026-11-03",
      startTime: "09:00",
      endDate: "2026-11-04",
      endTime: "00:30",
    });
  });
});

describe("a client's own meetings", () => {
  const ME = "me";
  const meeting = (extra: Partial<Booking> = {}) => ({ kind: "manual", status: "scheduled", createdBy: ME, ...extra }) as Booking;

  it("are the manual meetings the client created", () => {
    expect(ownMeeting(meeting(), ME)).toBe(true);
    expect(ownMeeting(meeting({ createdBy: "admin" }), ME)).toBe(false);
    expect(ownMeeting(meeting({ kind: "discovery", createdBy: null }), ME)).toBe(false);
    expect(ownMeeting(null, ME)).toBe(false);
  });

  it("move and stretch on the grid only while scheduled", () => {
    expect(clientGesture(meeting(), ME)).toEqual(MANUAL_GESTURE);
    expect(clientGesture(meeting({ status: "cancelled" }), ME)).toBeNull();
    expect(clientGesture(meeting({ status: "done" }), ME)).toBeNull();
    expect(clientGesture(meeting({ createdBy: "admin" }), ME)).toBeNull();
    expect(clientGesture(undefined, ME)).toBeNull();
  });
});
