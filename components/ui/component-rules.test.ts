import { describe, expect, it } from "vitest";
import { initialsOf } from "./avatar";
import { moveFocus } from "./calendar";
import { shiftBands } from "./schedule-calendar";
import { nextTab } from "./tabs";
import { sortTasks } from "./task-list";
import { pushToast } from "./toast";

describe("Calendar keyboard", () => {
  it("moves by day, week, week edge, month and year", () => {
    expect(moveFocus("ArrowRight", "2026-10-31", 0)).toBe("2026-11-01");
    expect(moveFocus("ArrowUp", "2026-10-16", 0)).toBe("2026-10-09");
    expect(moveFocus("Home", "2026-10-16", 0)).toBe("2026-10-11");
    expect(moveFocus("End", "2026-10-16", 1)).toBe("2026-10-18");
    expect(moveFocus("PageDown", "2026-01-31", 0)).toBe("2026-02-28");
    expect(moveFocus("PageUp", "2026-10-16", 0, true)).toBe("2025-10-16");
    expect(moveFocus("a", "2026-10-16", 0)).toBeNull();
  });
});

describe("Tabs keyboard", () => {
  it("skips disabled tabs and wraps around", () => {
    const tabs = [{}, { disabled: true }, {}];
    expect(nextTab(tabs, 0, 1)).toBe(2);
    expect(nextTab(tabs, 2, 1)).toBe(0);
    expect(nextTab(tabs, 0, -1)).toBe(2);
    expect(nextTab(tabs, -1, 1)).toBe(0);
  });
});

describe("Toast queue", () => {
  it("keeps the three newest; the oldest leaves first", () => {
    const toast = (id: string) => ({ id, title: id });
    const queue = ["a", "b", "c"].map(toast);
    expect(pushToast(queue, toast("d")).map((t) => t.id)).toEqual(["b", "c", "d"]);
    expect(pushToast([], toast("a")).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("ScheduleCalendar shifts", () => {
  const day = { kind: "day" as const, start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] };
  const night = { kind: "night" as const, start: "22:00", end: "06:00", days: [1, 2, 3, 4, 5] };

  it("shows a day shift only on its weekdays", () => {
    expect(shiftBands([day], "2026-10-14")).toEqual([{ kind: "day", label: undefined, from: 480, to: 1020 }]); // Wednesday
    expect(shiftBands([day], "2026-10-18")).toEqual([]); // Sunday
  });

  it("splits a night shift across midnight, starting on its own weekday", () => {
    // Monday: the shift starts at 22:00; Sunday night's shift didn't run, so no early-morning band.
    expect(shiftBands([night], "2026-10-12")).toEqual([{ kind: "night", label: undefined, from: 1320, to: 1440 }]);
    // Saturday: no new shift, but Friday's runs on until 06:00.
    expect(shiftBands([night], "2026-10-17")).toEqual([{ kind: "night", label: undefined, from: 0, to: 360 }]);
  });
});

describe("TaskList order and Avatar initials", () => {
  it("puts open tasks first, by due date", () => {
    const tasks = [
      { id: "1", title: "Done", done: true, due: "2026-10-01" },
      { id: "2", title: "Later", due: "2026-10-20" },
      { id: "3", title: "No date" },
      { id: "4", title: "Soon", due: "2026-10-15" },
    ];
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["4", "2", "3", "1"]);
  });

  it("takes up to two initials", () => {
    expect(initialsOf("Lia Santos")).toBe("LS");
    expect(initialsOf("  ana  maria cruz ")).toBe("AM");
    expect(initialsOf("Cher")).toBe("C");
  });
});
