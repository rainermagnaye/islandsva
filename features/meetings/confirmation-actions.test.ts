import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

// Confirm and Send confirmation email: role check first, parse, then the service. A failed email never undoes the
// confirm. The session, services and Next's cache are replaced; the parser and the notices are the real ones.

const requireRole = vi.fn();
const confirmDiscoveryCall = vi.fn();
const sendConfirmation = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("./service", () => ({
  confirmDiscoveryCall: (...args: unknown[]) => confirmDiscoveryCall(...args),
  sendConfirmation: (...args: unknown[]) => sendConfirmation(...args),
}));
vi.mock("./dal", () => ({ saveDiscoveryTimes: vi.fn() }));

const { confirmDiscoveryAction, sendDiscoveryConfirmationAction } = await import("./actions");

const MEETING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLOSER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function form(meetingId = MEETING) {
  const data = new FormData();
  data.set("meetingId", meetingId);
  return data;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: CLOSER });
  confirmDiscoveryCall.mockReset().mockResolvedValue({ ok: true });
  sendConfirmation.mockReset().mockResolvedValue("sent");
  refresh.mockReset();
});

describe("confirmDiscoveryAction", () => {
  it("checks the role before confirming or emailing", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(confirmDiscoveryAction(form())).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["admin", "closer"]);
    expect(confirmDiscoveryCall).not.toHaveBeenCalled();
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it("emails the visitor as the signed-in user after the confirm", async () => {
    expect(await confirmDiscoveryAction(form())).toEqual({ ok: true, notice: "Meeting confirmed. Confirmation email sent to the visitor." });
    expect(sendConfirmation).toHaveBeenCalledWith(MEETING, CLOSER);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("emails nothing when the confirm is refused", async () => {
    confirmDiscoveryCall.mockResolvedValue({ ok: false, message: "This call can't be changed now. Refresh the page." });
    expect(await confirmDiscoveryAction(form())).toMatchObject({ ok: false });
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it("still reports the call as confirmed when the email fails or the database is down", async () => {
    sendConfirmation.mockResolvedValue("failed");
    expect(await confirmDiscoveryAction(form())).toMatchObject({ ok: true, notice: expect.stringContaining("didn't go out") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendConfirmation.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await confirmDiscoveryAction(form())).toMatchObject({ ok: true, notice: expect.stringContaining("didn't go out") });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("says so when this isn't the live site", async () => {
    sendConfirmation.mockResolvedValue("skipped");
    expect(await confirmDiscoveryAction(form())).toMatchObject({ ok: true, notice: expect.stringContaining("only from the live site") });
  });
});

describe("sendDiscoveryConfirmationAction", () => {
  it("checks the role and the form before emailing", async () => {
    expect(await sendDiscoveryConfirmationAction(form("not-a-uuid"))).toMatchObject({ ok: false });
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(sendDiscoveryConfirmationAction(form())).rejects.toThrow("404");
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it("is ok when the email went out or already had", async () => {
    expect(await sendDiscoveryConfirmationAction(form())).toEqual({ ok: true, notice: "Confirmation email sent to the visitor." });
    sendConfirmation.mockResolvedValue("already_sent");
    expect(await sendDiscoveryConfirmationAction(form())).toMatchObject({ ok: true });
  });

  it("explains a failed, refused or unusable send", async () => {
    for (const [outcome, text] of [["failed", "didn't go out"], ["refused", "Only the call's Lead Gen"], ["bad_address", "can't be emailed"]] as const) {
      sendConfirmation.mockResolvedValue(outcome);
      expect(await sendDiscoveryConfirmationAction(form())).toEqual({ ok: false, message: expect.stringContaining(text) });
    }
  });
});
