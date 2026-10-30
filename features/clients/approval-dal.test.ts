import { beforeEach, describe, expect, it, vi } from "vitest";

// Approval goes through approve_client_payment (unique reference, current agreement); each refusal code becomes a
// reason the action maps to a message.

const supabase = vi.hoisted(() => ({ createAdminClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: supabase.rpc }) }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

const { approveClientPayment } = await import("./onboarding-dal");

const input = { clientId: "c1", actor: "admin-1", amountCents: 85500, feeCents: 1500, paidOn: "2026-10-20", reference: "TRX-1" };

beforeEach(() => supabase.rpc.mockReset().mockResolvedValue({ data: "p1", error: null }));

describe("approveClientPayment", () => {
  it("calls approve_client_payment (not the old accept_client_review_paid) with the given actor", async () => {
    expect(await approveClientPayment(input)).toEqual({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith("approve_client_payment", {
      client_id: "c1",
      actor: "admin-1",
      amount_cents: 85500,
      fee_cents: 1500,
      paid_on: "2026-10-20",
      reference: "TRX-1",
    });
  });

  it.each([
    ["IVA14", "not_allowed"],
    ["IVA21", "invalid"],
    ["IVA41", "reference_used"],
    ["IVA42", "reference_missing"],
    ["IVA43", "agreement_missing"],
    ["IVA06", "not_found"],
    ["IVA08", "submitted"],
    ["IVA09", "closed"],
  ])("maps %s to %s", async (code, reason) => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code, message: "refused" } });
    expect(await approveClientPayment(input)).toEqual({ ok: false, reason });
  });

  it("treats anything else as an outage", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    await expect(approveClientPayment(input)).rejects.toThrow(/Approving the payment for c1 failed \(23505\)/);
  });
});
