import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

// The client actions' own rules: the client check runs before anything else, the company is never read from the
// form, at least one assistant is required, refusals become messages. Session, service and cache are replaced.

const requireRole = vi.fn();
const refresh = vi.fn();
const service = {
  createClientBooking: vi.fn(),
  updateClientBooking: vi.fn(),
  cancelClientBooking: vi.fn(),
  completeClientBooking: vi.fn(),
  addClientBookingNote: vi.fn(),
};

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("./service", () => ({
  createClientBooking: (...args: unknown[]) => service.createClientBooking(...args),
  updateClientBooking: (...args: unknown[]) => service.updateClientBooking(...args),
  cancelClientBooking: (...args: unknown[]) => service.cancelClientBooking(...args),
  completeClientBooking: (...args: unknown[]) => service.completeClientBooking(...args),
  addClientBookingNote: (...args: unknown[]) => service.addClientBookingNote(...args),
}));

const { addClientBooking, cancelClientBookingAction, completeClientBookingAction, editClientBooking, saveClientBookingNote } = await import("./client-actions");

const VA = "7a0c7a43-2b8f-4c55-9a43-9a1d1c2d3e4f";
const OTHER_CLIENT = "0b6f2bb5-1c1e-4f0d-8f31-3c0a7b1d2e3f";
const MEETING = "5d0c0f7e-8f0a-4b8e-9d7a-2a1b3c4d5e6f";

const meetingForm = (extra: Record<string, string | string[]> = {}) => {
  const data = new FormData();
  const fields: Record<string, string | string[]> = {
    title: "Weekly sync",
    startDate: "2026-11-03",
    startTime: "09:00",
    endDate: "2026-11-03",
    endTime: "10:00",
    staffIds: [VA],
    ...extra,
  };
  for (const [name, value] of Object.entries(fields)) for (const item of [value].flat()) data.append(name, item);
  return data;
};
const idForm = () => {
  const data = new FormData();
  data.set("meetingId", MEETING);
  return data;
};

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "client" });
  refresh.mockReset();
  for (const fn of Object.values(service)) fn.mockReset().mockResolvedValue({ ok: true });
});

describe("client meeting actions", () => {
  it.each([
    ["add", () => addClientBooking(meetingForm())],
    ["edit", () => editClientBooking(meetingForm({ meetingId: MEETING }))],
    ["cancel", () => cancelClientBookingAction(idForm())],
    ["complete", () => completeClientBookingAction(idForm())],
    ["note", () => {
      const data = idForm();
      data.set("note", "Agenda");
      return saveClientBookingNote(data);
    }],
  ])("%s checks the client role before anything else", async (_name, run) => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(run()).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["client"]);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("books with the client's assistants and never reads a company from the form", async () => {
    expect(await addClientBooking(meetingForm({ clientIds: [OTHER_CLIENT] }))).toEqual({ ok: true });
    const [input] = service.createClientBooking.mock.calls[0];
    expect(input).toMatchObject({ title: "Weekly sync", staffIds: [VA], clientIds: [] });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("asks for at least one assistant without saving", async () => {
    const result = await addClientBooking(meetingForm({ staffIds: [] }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { staffIds: "Invite at least one of your assistants." } });
    expect(service.createClientBooking).not.toHaveBeenCalled();
    expect(await editClientBooking(meetingForm({ meetingId: MEETING, staffIds: [] }))).toMatchObject({ ok: false });
    expect(service.updateClientBooking).not.toHaveBeenCalled();
  });

  it("returns field errors and refusals as messages, without refreshing", async () => {
    expect(await addClientBooking(meetingForm({ endTime: "08:00" }))).toMatchObject({ ok: false, fieldErrors: { endTime: expect.any(String) } });
    service.updateClientBooking.mockResolvedValue({ ok: false, message: "Choose a start time that hasn't passed yet." });
    expect(await editClientBooking(meetingForm({ meetingId: MEETING }))).toEqual({ ok: false, message: "Choose a start time that hasn't passed yet." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers an outage with try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.cancelClientBooking.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await cancelClientBookingAction(idForm())).toEqual({ ok: false, message: "We couldn't cancel this meeting just now. Please try again in a moment." });
  });
});
