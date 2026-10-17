import { describe, expect, it } from "vitest";
import { LEAD_STATUSES, isConvertible, leadProfileTab, nextStatuses } from "./contract";

describe("lead triage rules", () => {
  it("lets open leads move between contacted, qualified and closed", () => {
    expect(nextStatuses("new")).toEqual(["contacted", "qualified", "closed"]);
    expect(nextStatuses("contacted")).toEqual(["qualified", "closed"]);
    expect(nextStatuses("qualified")).toEqual(["contacted", "closed"]);
  });

  it("only reopens a closed lead, and never moves a converted one", () => {
    expect(nextStatuses("closed")).toEqual(["new"]);
    expect(nextStatuses("converted")).toEqual([]);
  });

  it("never offers 'converted' by hand, and converts only open leads", () => {
    for (const status of LEAD_STATUSES) expect(nextStatuses(status)).not.toContain("converted");
    expect(LEAD_STATUSES.filter(isConvertible)).toEqual(["new", "contacted", "qualified"]);
  });
});

describe("lead profile tab", () => {
  it("opens Overview unless the URL asks for Timeline", () => {
    expect(leadProfileTab(undefined)).toBe("overview");
    expect(leadProfileTab("overview")).toBe("overview");
    expect(leadProfileTab("nope")).toBe("overview");
    expect(leadProfileTab(["timeline", "overview"])).toBe("timeline");
    expect(leadProfileTab("timeline")).toBe("timeline");
  });
});
