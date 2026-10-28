import { describe, expect, it } from "vitest";
import type { TaskEvent } from "./contract";
import { lastAt, openFeedback, progressStep, taskActivity } from "./activity";

const task = {
  createdAt: "2026-10-27T01:15:00.000Z",
  createdBy: "client-1",
  startedAt: null as string | null,
  doneAt: null as string | null,
  vaId: "va-1",
  vaFirstName: "Lia",
};

const event = (id: string, kind: TaskEvent["kind"], createdAt: string, note: string | null = null, actorId: string | null = "va-1"): TaskEvent => ({
  id,
  kind,
  note,
  actorId,
  actorFirstName: actorId ? "Lia" : null,
  createdAt,
});

describe("taskActivity", () => {
  it("starts with the task being added, then each move oldest first", () => {
    const events = [
      event("e2", "submitted", "2026-10-28T07:05:00.000Z", "In the shared folder"),
      event("e1", "started", "2026-10-28T01:40:00.000Z"),
      event("e3", "changes_requested", "2026-10-28T09:00:00.000Z", "Use the new logo", "client-1"),
    ];
    const entries = taskActivity({ ...task, startedAt: "2026-10-28T01:40:00.000Z" }, events);
    expect(entries.map((entry) => entry.kind)).toEqual(["added", "started", "submitted", "changes_requested"]);
    expect(entries[0].actor).toEqual({ id: "client-1", firstName: null });
    expect(entries[2].note).toBe("In the shared folder");
  });

  it("fills the start and close of a task from before the activity existed", () => {
    const entries = taskActivity({ ...task, startedAt: "2026-10-27T03:00:00.000Z", doneAt: "2026-10-27T05:00:00.000Z" }, []);
    expect(entries.map((entry) => [entry.kind, entry.actor])).toEqual([
      ["added", { id: "client-1", firstName: null }],
      ["started", { id: "va-1", firstName: "Lia" }],
      ["closed", null],
    ]);
  });

  it("does not add a close from the row when an event already records it", () => {
    const entries = taskActivity({ ...task, doneAt: "2026-10-28T10:00:00.000Z" }, [event("e1", "approved", "2026-10-28T10:00:00.000Z", null, "client-1")]);
    expect(entries.map((entry) => entry.kind)).toEqual(["added", "approved"]);
  });

  it("shows a server move as having no named person", () => {
    const [, entry] = taskActivity(task, [event("e1", "closed", "2026-10-28T10:00:00.000Z", null, null)]);
    expect(entry.actor).toEqual({ id: null, firstName: null });
  });
});

describe("progressStep", () => {
  it("marks every step done once closed", () => {
    expect([progressStep("todo"), progressStep("in_progress"), progressStep("review"), progressStep("done")]).toEqual([0, 1, 2, 4]);
  });
});

describe("openFeedback", () => {
  const sentBack = event("e2", "changes_requested", "2026-10-28T09:00:00.000Z", "Use the new logo", "client-1");

  it("is the last move while the task is back with the VA", () => {
    expect(openFeedback("in_progress", [event("e1", "submitted", "2026-10-28T07:00:00.000Z"), sentBack])).toEqual(sentBack);
  });

  it("is gone once the VA submits again, or when nothing sent it back", () => {
    expect(openFeedback("review", [sentBack, event("e3", "submitted", "2026-10-28T11:00:00.000Z")])).toBeNull();
    expect(openFeedback("in_progress", [event("e1", "started", "2026-10-28T07:00:00.000Z")])).toBeNull();
    expect(openFeedback("in_progress", [])).toBeNull();
  });
});

describe("lastAt", () => {
  it("is the latest time of those kinds, or null", () => {
    const events = [event("e1", "submitted", "2026-10-28T07:00:00.000Z"), event("e2", "submitted", "2026-10-28T11:00:00.000Z")];
    expect(lastAt(events, ["submitted"])).toBe("2026-10-28T11:00:00.000Z");
    expect(lastAt(events, ["approved", "closed"])).toBeNull();
  });
});
