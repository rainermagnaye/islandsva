import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

// Reject and outcome: closer check first, parse the form, then the service. The session, services and
// Next's cache are replaced; the parser is the real one.

const requireRole = vi.fn();
const rejectDiscoveryCall = vi.fn();
const saveDiscoveryOutcome = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("./service", () => ({
  rejectDiscoveryCall: (...args: unknown[]) => rejectDiscoveryCall(...args),
  saveDiscoveryOutcome: (...args: unknown[]) => saveDiscoveryOutcome(...args),
}));
vi.mock("./dal", () => ({ saveDiscoveryTimes: vi.fn() }));

const { rejectDiscoveryAction, recordDiscoveryOutcomeAction } = await import("./actions");

const MEETING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLOSER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function rejectForm(reason: string, meetingId = MEETING) {
  const data = new FormData();
  data.set("meetingId", meetingId);
  data.set("reason", reason);
  return data;
}

function outcomeForm(outcome: "done" | "no_show", note = "", meetingId = MEETING) {
  const data = new FormData();
  data.set("meetingId", meetingId);
  data.set("outcome", outcome);
  data.set("note", note);
  return data;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: CLOSER });
  rejectDiscoveryCall.mockReset().mockResolvedValue({ ok: true });
  saveDiscoveryOutcome.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("rejectDiscoveryAction", () => {
  it("checks the closer role before reading or saving anything", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(rejectDiscoveryAction(rejectForm("Not a fit."))).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["closer"]);
    expect(rejectDiscoveryCall).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sends the signed-in closer as the actor and refreshes", async () => {
    expect(await rejectDiscoveryAction(rejectForm("Not a fit."))).toEqual({ ok: true });
    expect(rejectDiscoveryCall).toHaveBeenCalledWith(MEETING, CLOSER, "Not a fit.");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns field errors without calling the database", async () => {
    const result = await rejectDiscoveryAction(rejectForm("   "));
    expect(result).toMatchObject({ ok: false, fieldErrors: { reason: "Say why you're declining." } });
    expect(rejectDiscoveryCall).not.toHaveBeenCalled();
  });

  it("surfaces a refusal from another closer or a missing call", async () => {
    rejectDiscoveryCall.mockResolvedValue({ ok: false, message: "Only an admin or a lead gen from this agency can change this call." });
    expect(await rejectDiscoveryAction(rejectForm("Not a fit."))).toEqual({
      ok: false,
      message: "Only an admin or a lead gen from this agency can change this call.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers an outage with try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rejectDiscoveryCall.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await rejectDiscoveryAction(rejectForm("Not a fit."))).toEqual({
      ok: false,
      message: "We couldn't decline this call just now. Please try again in a moment.",
    });
  });
});

describe("recordDiscoveryOutcomeAction", () => {
  it("checks the closer role before reading or saving anything", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(recordDiscoveryOutcomeAction(outcomeForm("done"))).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["closer"]);
    expect(saveDiscoveryOutcome).not.toHaveBeenCalled();
  });

  it("records Done with the signed-in closer as the actor", async () => {
    expect(await recordDiscoveryOutcomeAction(outcomeForm("done", "Agreed a package."))).toEqual({ ok: true });
    expect(saveDiscoveryOutcome).toHaveBeenCalledWith(MEETING, CLOSER, "done", "Agreed a package.");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("records a no-show", async () => {
    expect(await recordDiscoveryOutcomeAction(outcomeForm("no_show"))).toEqual({ ok: true });
    expect(saveDiscoveryOutcome).toHaveBeenCalledWith(MEETING, CLOSER, "no_show", "");
  });

  it("surfaces a call that has not started yet", async () => {
    saveDiscoveryOutcome.mockResolvedValue({ ok: false, message: "This call can't be changed now. Refresh the page." });
    expect(await recordDiscoveryOutcomeAction(outcomeForm("done"))).toEqual({
      ok: false,
      message: "This call can't be changed now. Refresh the page.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
