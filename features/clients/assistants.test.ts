import { describe, expect, it } from "vitest";
import { assistantTaskCounts, clientAssistantRows, packageBalanceLabel } from "./assistants";

describe("assistantTaskCounts", () => {
  it("counts closed against every task for that VA", () => {
    const counts = assistantTaskCounts([
      { vaId: "va-1", status: "todo" },
      { vaId: "va-1", status: "done" },
      { vaId: "va-2", status: "done" },
    ]);
    expect(counts.get("va-1")).toEqual({ closed: 1, total: 2 });
    expect(counts.get("va-2")).toEqual({ closed: 1, total: 1 });
  });
});

describe("clientAssistantRows", () => {
  it("lists assigned VAs before open offers and skips a VA already assigned", () => {
    const rows = clientAssistantRows({
      assignments: [{ id: "as-1", vaId: "va-1", vaName: "Ana" }],
      offers: [
        { vaId: "va-1", vaFirstName: "Ana", status: "offered" },
        { vaId: "va-2", vaFirstName: "Lia", status: "offered" },
        { vaId: "va-3", vaFirstName: "Old", status: "declined" },
      ],
      tasks: [
        { vaId: "va-1", status: "todo" },
        { vaId: "va-1", status: "done" },
      ],
      hoursPerWeek: 20,
      hrefFor: (id) => `/admin/clients/c1/vas/${id}`,
    });
    expect(rows.map((row) => row.vaId)).toEqual(["va-1", "va-2"]);
    expect(rows[0]).toMatchObject({ name: "Ana", status: "active", closedTasks: 1, totalTasks: 2, href: "/admin/clients/c1/vas/va-1" });
    expect(rows[1]).toMatchObject({ name: "Lia", status: "offered", closedTasks: 0, totalTasks: 0, href: null });
  });
});

describe("packageBalanceLabel", () => {
  it("shows contracted weekly hours until timesheets exist", () => {
    expect(packageBalanceLabel(20)).toBe("20 h / week");
    expect(packageBalanceLabel(null)).toBe("Not set");
  });
});
