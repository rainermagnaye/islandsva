import { describe, expect, it } from "vitest";
import { matchStage, openDemo, type DemoForMatch } from "./stage";

const demo = (id: string, vaId: string, state: DemoForMatch["state"], startsAt: string): DemoForMatch => ({ id, vaId, state, startsAt, rejectReason: null });

describe("matchStage", () => {
  it("is new with no demo, and remembers the last refused one", () => {
    expect(matchStage({ vaId: "lia" }, [])).toEqual({ kind: "new", last: null });
    const refused = demo("d1", "lia", "rejected", "2026-10-30T02:00:00Z");
    expect(matchStage({ vaId: "lia" }, [refused, demo("d2", "marco", "pending", "2026-10-31T02:00:00Z")])).toEqual({ kind: "new", last: refused });
  });

  it("follows an open request through to a call that happened", () => {
    const pending = demo("d1", "lia", "pending", "2026-10-30T02:00:00Z");
    expect(matchStage({ vaId: "lia" }, [pending])).toEqual({ kind: "requested", demo: pending });
    const confirmed = { ...pending, state: "confirmed" as const };
    expect(matchStage({ vaId: "lia" }, [confirmed])).toEqual({ kind: "confirmed", demo: confirmed });
    const done = { ...pending, state: "completed" as const };
    expect(matchStage({ vaId: "lia" }, [done])).toEqual({ kind: "met", demo: done });
  });

  it("stays met when a later request with the same VA is cancelled", () => {
    const met = demo("d1", "lia", "completed", "2026-10-20T02:00:00Z");
    expect(matchStage({ vaId: "lia" }, [met, demo("d2", "lia", "cancelled", "2026-10-30T02:00:00Z")])).toEqual({ kind: "met", demo: met });
  });
});

describe("openDemo", () => {
  it("finds the one open demo across VAs", () => {
    expect(openDemo([demo("d1", "lia", "completed", "2026-10-20T02:00:00Z")])).toBeNull();
    expect(openDemo([demo("d2", "marco", "confirmed", "2026-10-30T02:00:00Z")])?.id).toBe("d2");
  });
});
