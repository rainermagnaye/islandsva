import { describe, expect, it } from "vitest";
import { hoursSummary, toProfile } from "./profile";

const row = {
  va_id: "va-1",
  first_name: "Lia",
  skills: "Inbox management, Calendar\nTravel booking, ",
  languages: "English, Filipino",
  highest_education: "Bachelor's",
  certifications: "  ",
  employers: [{ position: "Executive Assistant", company: "Brightpath", duration: "2022 – 2026" }, { nonsense: true }, "bad"],
  key_responsibilities: "Ran two inboxes",
  achievements: null,
  working_hours: [
    { weekday: 2, start: 540, end: 1080 },
    { weekday: 1, start: 540, end: 1080 },
    { weekday: 3, start: 540, end: 1080 },
    { weekday: "x", start: 1, end: 2 },
  ],
};

describe("toProfile", () => {
  it("reads skills as a list, the latest role as the headline, and drops malformed entries", () => {
    const profile = toProfile(row);
    expect(profile.skills).toEqual(["Inbox management", "Calendar", "Travel booking"]);
    expect(profile.headline).toBe("Executive Assistant");
    expect(profile.employers).toHaveLength(1);
    expect(profile.certifications).toBeNull();
    expect(profile.hours.map((window) => window.weekday)).toEqual([1, 2, 3]);
  });

  it("has no headline when no role is listed", () => {
    expect(toProfile({ ...row, employers: null }).headline).toBeNull();
  });
});

describe("hoursSummary", () => {
  const hours = toProfile(row).hours;
  const now = new Date("2026-10-28T03:00:00Z");

  it("joins days in a row and gives Manila's time only for a viewer in Manila", () => {
    expect(hoursSummary(hours, "Asia/Manila", now)).toEqual({ manila: "Mon–Wed · 9 am–6 pm Manila", yours: null });
  });

  it("adds the viewer's own time, wrapping past midnight", () => {
    // New York is UTC−4 on Oct 28, 2026: twelve hours behind Manila.
    expect(hoursSummary(hours, "America/New_York", now)?.yours).toBe("9 pm–6 am your time");
  });

  it("is null without working hours", () => {
    expect(hoursSummary([], "Asia/Manila", now)).toBeNull();
  });
});
