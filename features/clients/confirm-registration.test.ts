import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, FORM_ERROR } from "@/lib/validation";

// "Approve and send invite": the admin check comes first, the actor is the session's user (never a form field), the
// payment is approved before any invite, and an invite that fails leaves the client approved with a clear message.

const requireRole = vi.fn();
const confirmClientReviewPaid = vi.fn();
const sendClientActivation = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./link", () => ({ registrationOrigin: async () => "https://app.test" }));
vi.mock("./service", () => ({
  confirmClientReviewPaid: (...args: unknown[]) => confirmClientReviewPaid(...args),
  sendClientActivation: (...args: unknown[]) => sendClientActivation(...args),
}));
vi.mock("./assignment-dal", () => ({}));
vi.mock("./dal", () => ({}));
vi.mock("./message-dal", () => ({}));

const { confirmClientRegistration } = await import("./actions");

const clientId = "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60";
const form = (fields: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ clientId, amount: "855.00", fee: "", paidOn: "2026-10-01", reference: " TRX-1 ", ...fields })) data.append(name, value);
  return data;
};

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "admin-1" });
  confirmClientReviewPaid.mockReset().mockResolvedValue({ ok: true });
  sendClientActivation.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("confirmClientRegistration", () => {
  it("checks the admin role before parsing, approving or inviting", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(confirmClientRegistration(form())).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(confirmClientReviewPaid).not.toHaveBeenCalled();
    expect(sendClientActivation).not.toHaveBeenCalled();
  });

  it("approves as the signed-in admin, then sends the invite", async () => {
    expect(await confirmClientRegistration(form())).toEqual({ ok: true });
    expect(confirmClientReviewPaid).toHaveBeenCalledWith({ clientId, amount: 85500, fee: 0, paidOn: "2026-10-01", reference: "TRX-1" }, "admin-1");
    expect(sendClientActivation).toHaveBeenCalledWith(clientId, "admin-1", "https://app.test");
    expect(confirmClientReviewPaid.mock.invocationCallOrder[0]).toBeLessThan(sendClientActivation.mock.invocationCallOrder[0]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("never takes the actor from the form: an extra field is a tampered form", async () => {
    expect(await confirmClientRegistration(form({ actor: "someone-else" }))).toEqual({ ok: false, message: FORM_ERROR });
    expect(confirmClientReviewPaid).not.toHaveBeenCalled();
  });

  it("never approves on a parse failure (the reference is required)", async () => {
    expect(await confirmClientRegistration(form({ reference: "​ " }))).toMatchObject({ ok: false, fieldErrors: { reference: "Enter the payment reference." } });
    expect(confirmClientReviewPaid).not.toHaveBeenCalled();
  });

  it.each([
    ["reference_used", { message: FIELD_ERRORS, fieldErrors: { reference: "This reference is already recorded for another payment." } }],
    ["reference_missing", { message: FIELD_ERRORS, fieldErrors: { reference: "Enter the payment reference." } }],
    ["agreement_missing", { message: "The client must accept the current agreement before you approve. Send the Agreement back to them." }],
    ["not_allowed", { message: "Only an admin of this agency can confirm registrations." }],
    ["invalid", { message: "That amount, fee or date can't be recorded. Check them and try again." }],
    ["submitted", { message: "This registration is not in review. Refresh the page." }],
    ["not_found", { message: "This registration is not in review. Refresh the page." }],
    ["closed", { message: "This registration is not in review. Refresh the page." }],
  ])("explains %s and sends no invite", async (reason, expected) => {
    confirmClientReviewPaid.mockResolvedValue({ ok: false, reason });
    expect(await confirmClientRegistration(form())).toEqual({ ok: false, ...expected });
    expect(sendClientActivation).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("an approval outage sends no invite", async () => {
    confirmClientReviewPaid.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await confirmClientRegistration(form())).toMatchObject({ ok: false });
    expect(sendClientActivation).not.toHaveBeenCalled();
  });

  it.each([
    ["is refused", () => sendClientActivation.mockResolvedValue({ ok: false, reason: "rate" })],
    ["is unreachable", () => sendClientActivation.mockRejectedValue(new UpstreamError("supabase", "down"))],
  ])("when the invite %s, the client stays approved and the admin is told", async (_, fail) => {
    fail();
    expect(await confirmClientRegistration(form())).toEqual({ ok: false, message: "Payment verified, but the invite wasn't sent. Use Send activation to try again." });
    expect(confirmClientReviewPaid).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
