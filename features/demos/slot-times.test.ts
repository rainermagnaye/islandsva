import { describe, expect, it } from "vitest";
import { manilaToIso } from "./contract";
import { busyFrom, overlapping, slotCells, slotLabel, splitFree, workingTimes, type BusyTime } from "./slot-times";

// Friday Oct 30, 2026, 6:00 pm in Manila.
const NOW = new Date("2026-10-30T10:00:00.000Z");
const DAY = "2026-10-31"; // Saturday
const meeting: BusyTime = { start: manilaToIso(DAY, "14:00"), end: manilaToIso(DAY, "14:45"), label: "Planning call · Harbor Legal" };
const demo: BusyTime = { start: manilaToIso(DAY, "09:00"), end: manilaToIso(DAY, "09:30"), label: "Demo call · Brightpath Tutors" };

describe("demo slot times", () => {
  it("says a time the way people read it", () => {
    expect([slotLabel("00:00"), slotLabel("09:30"), slotLabel("12:00"), slotLabel("23:30")]).toEqual(["12:00 am", "9:30 am", "12:00 pm", "11:30 pm"]);
  });

  it("locks a half hour that overlaps a booking, but not one that only touches it", () => {
    expect(overlapping(manilaToIso(DAY, "14:30"), [meeting])).toBe(meeting);
    expect(overlapping(manilaToIso(DAY, "13:30"), [meeting])).toBeUndefined();
    expect(overlapping(manilaToIso(DAY, "14:45"), [meeting])).toBeUndefined();
    expect(overlapping(manilaToIso(DAY, "09:30"), [demo])).toBeUndefined();
  });

  it("marks each time free, offered, booked or past", () => {
    const cells = slotCells(DAY, [manilaToIso(DAY, "09:30")], [meeting, demo], NOW);
    const state = (time: string) => cells.find((cell) => cell.time === time);
    expect(cells).toHaveLength(48);
    expect(state("09:00")).toMatchObject({ state: "booked", reason: "Demo call · Brightpath Tutors, 9:00 am – 9:30 am" });
    expect(state("09:30")?.state).toBe("offered");
    expect(state("14:00")?.state).toBe("booked");
    expect(state("14:30")?.state).toBe("booked");
    expect(state("15:00")?.state).toBe("free");
    expect(slotCells("2026-10-30", [], [], NOW).find((cell) => cell.time === "17:30")?.state).toBe("past");
    expect(slotCells("2026-10-30", [], [], NOW).find((cell) => cell.time === "18:30")?.state).toBe("free");
  });

  it("fills only free times inside the day's working window", () => {
    const cells = slotCells(DAY, [manilaToIso(DAY, "09:30")], [meeting, demo], NOW);
    // Saturday is weekday 6.
    const windows = [{ weekday: 6, startMinute: 8 * 60 + 30, endMinute: 11 * 60 }];
    expect(workingTimes(cells, DAY, windows)).toEqual(["08:30", "10:00", "10:30"]);
    expect(workingTimes(cells, DAY, [{ weekday: 1, startMinute: 0, endMinute: 1440 }])).toEqual([]);
  });

  it("keeps the free starts and names the ones a booking took", () => {
    const starts = [manilaToIso(DAY, "10:00"), manilaToIso(DAY, "14:30")];
    const { free, taken } = splitFree(starts, [meeting]);
    expect(free).toEqual([starts[0]]);
    expect(taken).toEqual([{ startsAt: starts[1], busy: meeting }]);
  });
});

describe("busyFrom", () => {
  it("keeps live meetings and open demos, labelled", () => {
    const busy = busyFrom(
      [
        { title: "Kickoff", status: "scheduled", startsAt: "a", endsAt: "b", clientName: "Acme" },
        { title: "Old", status: "cancelled", startsAt: "c", endsAt: "d", clientName: null },
      ],
      [
        { status: "pending", startsAt: "e", endsAt: "f", companyName: "Beta" },
        { status: "confirmed", startsAt: "g", endsAt: "h", companyName: "Cove" },
        { status: "rejected", startsAt: "i", endsAt: "j", companyName: "Dune" },
      ],
    );
    expect(busy.map((item) => item.label)).toEqual(["Kickoff · Acme", "Demo request · Beta", "Demo call · Cove"]);
  });
});
