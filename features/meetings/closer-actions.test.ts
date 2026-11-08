import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

const requireRole = vi.fn();
const createCloserMeeting = vi.fn();
const createCloserSlotMeetings = vi.fn();
const cancelCloserMeeting = vi.fn();
const bookVaTask = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/features/tasks/service", () => ({ bookVaTask: (...args: unknown[]) => bookVaTask(...args) }));

vi.mock("./service", () => ({
  createCloserMeeting: (...args: unknown[]) => createCloserMeeting(...args),
  cancelCloserMeeting: (...args: unknown[]) => cancelCloserMeeting(...args),
  createCloserSlotMeetings: (...args: unknown[]) => createCloserSlotMeetings(...args),
}));

const { addCloserMeeting, addCloserSlots, addCloserTask, cancelCloserMeetingAction } = await import("./closer-actions");

const MEETING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function meetingForm() {
  const data = new FormData();
  data.set("title", "Discovery recap");
  data.set("clientId", "");
  data.set("date", "2026-11-10");
  data.set("startTime", "10:00");
  data.set("minutes", "30");
  data.set("note", "");
  return data;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "closer" });
  createCloserMeeting.mockReset().mockResolvedValue({ ok: true });
  createCloserSlotMeetings.mockReset().mockResolvedValue({ ok: true });
  cancelCloserMeeting.mockReset().mockResolvedValue({ ok: true });
  bookVaTask.mockReset().mockResolvedValue({ ok: true, kind: "todo" });
  refresh.mockReset();
});

describe("addCloserSlots", () => {
  it("checks the closer role before saving slots", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    const data = new FormData();
    data.set("date", "2026-11-10");
    data.append("times", "10:00");
    await expect(addCloserSlots(data)).rejects.toThrow("404");
    expect(createCloserSlotMeetings).not.toHaveBeenCalled();
  });

  it("books a 30-minute meeting for each picked time", async () => {
    const data = new FormData();
    data.set("date", "2026-11-10");
    data.append("times", "10:00");
    expect(await addCloserSlots(data)).toEqual({ ok: true });
    expect(createCloserSlotMeetings).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

function taskForm() {
  const data = new FormData();
  data.set("mode", "new");
  data.set("title", "Pipeline prep");
  data.set("date", "2026-11-10");
  data.set("startTime", "20:00");
  data.set("minutes", "60");
  return data;
}

describe("addCloserTask", () => {
  it("checks the closer role before answering", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(addCloserTask(new FormData())).rejects.toThrow("404");
    expect(bookVaTask).not.toHaveBeenCalled();
  });

  it("saves a to-do and refreshes", async () => {
    expect(await addCloserTask(taskForm())).toEqual({ ok: true });
    expect(bookVaTask).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("addCloserMeeting", () => {
  it("checks the closer role before reading or saving anything", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(addCloserMeeting(meetingForm())).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["closer"]);
    expect(createCloserMeeting).not.toHaveBeenCalled();
  });

  it("books a team meeting and refreshes", async () => {
    expect(await addCloserMeeting(meetingForm())).toEqual({ ok: true });
    expect(createCloserMeeting).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("answers an outage with try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createCloserMeeting.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await addCloserMeeting(meetingForm())).toEqual({
      ok: false,
      message: "We couldn't book this meeting just now. Please try again in a moment.",
    });
  });
});

describe("cancelCloserMeetingAction", () => {
  it("checks the closer role before cancelling", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    const data = new FormData();
    data.set("meetingId", MEETING);
    await expect(cancelCloserMeetingAction(data)).rejects.toThrow("404");
    expect(cancelCloserMeeting).not.toHaveBeenCalled();
  });
});
