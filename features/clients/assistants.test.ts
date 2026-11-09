import { describe, expect, it } from "vitest";
import { assistantTaskCounts, canAssignVa, clientAssistantRows, packageBalanceLabel, vaSlotsLeft, vasForPackage } from "./assistants";

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

describe("vasForPackage", () => {
  it("gives Day and night two VAs and every other package one", () => {
    expect(vasForPackage("day-and-night")).toBe(2);
    expect(vasForPackage("essentials")).toBe(1);
    expect(vasForPackage("executive")).toBe(1);
    expect(vasForPackage(null)).toBe(1);
  });

  it("counts the slots still open and never goes below zero", () => {
    expect(vaSlotsLeft("essentials", 0)).toBe(1);
    expect(vaSlotsLeft("essentials", 1)).toBe(0);
    expect(vaSlotsLeft("day-and-night", 1)).toBe(1);
    expect(vaSlotsLeft("day-and-night", 3)).toBe(0);
  });
});

describe("canAssignVa", () => {
  const approved = { status: "pending", onboardingStatus: "approved", disabledAt: null, packageCode: "essentials" };

  it("allows an approved, invited or active client with a package", () => {
    expect(canAssignVa(approved)).toBe(true);
    expect(canAssignVa({ ...approved, onboardingStatus: "invite_sent" })).toBe(true);
    expect(canAssignVa({ ...approved, status: "active", onboardingStatus: null })).toBe(true);
  });

  it("refuses before approval, when disabled, without a package, or once inactive", () => {
    for (const step of ["ready", "pending_customer", "pending_review", "changes_requested"]) {
      expect(canAssignVa({ ...approved, onboardingStatus: step })).toBe(false);
    }
    expect(canAssignVa({ ...approved, disabledAt: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(canAssignVa({ ...approved, packageCode: null })).toBe(false);
    expect(canAssignVa({ ...approved, status: "inactive" })).toBe(false);
  });
});
