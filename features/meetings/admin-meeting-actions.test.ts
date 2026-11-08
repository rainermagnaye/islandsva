import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

const requireRole = vi.fn();
const createAdminMeeting = vi.fn();
const createAdminSlotMeetings = vi.fn();
const bookVaTask = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("./dal", () => ({ saveDiscoveryTimes: vi.fn() }));
vi.mock("@/features/tasks/service", () => ({ bookVaTask: (...args: unknown[]) => bookVaTask(...args) }));
vi.mock("./service", () => ({
  createAdminMeeting: (...args: unknown[]) => createAdminMeeting(...args),
  createAdminSlotMeetings: (...args: unknown[]) => createAdminSlotMeetings(...args),
}));

const { addAdminMeeting, addAdminSlots, addAdminTask } = await import("./actions");

function meetingForm() {
  const data = new FormData();
  data.set("title", "Pipeline review");
  data.set("clientId", "");
  data.set("date", "2026-11-10");
  data.set("startTime", "10:00");
  data.set("minutes", "30");
  data.set("note", "");
  return data;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "admin" });
  createAdminMeeting.mockReset().mockResolvedValue({ ok: true });
  createAdminSlotMeetings.mockReset().mockResolvedValue({ ok: true });
  bookVaTask.mockReset().mockResolvedValue({ ok: true, kind: "todo" });
  refresh.mockReset();
});

describe("addAdminMeeting", () => {
  it("checks the admin role before reading or saving anything", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(addAdminMeeting(meetingForm())).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(createAdminMeeting).not.toHaveBeenCalled();
  });

  it("books a team meeting and refreshes", async () => {
    expect(await addAdminMeeting(meetingForm())).toEqual({ ok: true });
    expect(createAdminMeeting).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("answers an outage with try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createAdminMeeting.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await addAdminMeeting(meetingForm())).toEqual({
      ok: false,
      message: "We couldn't book this meeting just now. Please try again in a moment.",
    });
  });
});

describe("addAdminSlots", () => {
  it("checks the admin role before saving slots", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    const data = new FormData();
    data.set("date", "2026-11-10");
    data.append("times", "10:00");
    await expect(addAdminSlots(data)).rejects.toThrow("404");
    expect(createAdminSlotMeetings).not.toHaveBeenCalled();
  });

  it("books a 30-minute meeting for each picked time", async () => {
    const data = new FormData();
    data.set("date", "2026-11-10");
    data.append("times", "10:00");
    expect(await addAdminSlots(data)).toEqual({ ok: true });
    expect(createAdminSlotMeetings).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("addAdminTask", () => {
  it("checks the admin role before answering", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(addAdminTask(new FormData())).rejects.toThrow("404");
    expect(bookVaTask).not.toHaveBeenCalled();
  });

  it("saves a to-do and refreshes", async () => {
    const data = new FormData();
    data.set("mode", "new");
    data.set("title", "Board pack");
    data.set("date", "2026-11-10");
    data.set("startTime", "20:00");
    data.set("minutes", "60");
    expect(await addAdminTask(data)).toEqual({ ok: true });
    expect(bookVaTask).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
