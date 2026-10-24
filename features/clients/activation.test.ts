import { describe, expect, it } from "vitest";
import { activationBlockers } from "./activation-contract";
import { parseManualPayment, parsePaymentTarget } from "./activation-validation";
import { clientRegistrationSteps, emptyClientBusiness, progressOf } from "./contract";

const clientId = "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60";
const now = new Date("2026-10-24T12:00:00Z");

describe("parseManualPayment", () => {
  it("turns dollars as typed into cents", () => {
    for (const [typed, cents] of [["855", 85500], ["855.5", 85550], ["1,200.50", 120050], [" 0.01 ", 1]] as const) {
      expect(parseManualPayment({ clientId, amount: typed, reference: " TRX-1 ", paidOn: "2026-10-20" }, now)).toEqual({
        ok: true,
        value: { clientId, amountCents: cents, reference: "TRX-1", paidOn: "2026-10-20" },
      });
    }
  });

  it("refuses amounts that aren't money, are zero, or are too large", () => {
    for (const amount of ["", "abc", "-5", "10.555", "0", "0.00", "10000001"]) {
      expect(parseManualPayment({ clientId, amount, paidOn: "2026-10-20" }, now)).toMatchObject({ ok: false, fieldErrors: { amount: expect.any(String) } });
    }
  });

  it("refuses a date in the future or one that doesn't exist", () => {
    expect(parseManualPayment({ clientId, amount: "1", paidOn: "2026-10-26" }, now)).toMatchObject({ ok: false, fieldErrors: { paidOn: expect.any(String) } });
    expect(parseManualPayment({ clientId, amount: "1", paidOn: "2026-02-30" }, now)).toMatchObject({ ok: false, fieldErrors: { paidOn: expect.any(String) } });
    expect(parseManualPayment({ clientId, amount: "1", paidOn: "2026-10-24" }, now).ok).toBe(true);
    expect(parseManualPayment({ clientId, amount: "1", paidOn: "2026-10-25" }, now)).toMatchObject({ ok: false, fieldErrors: { paidOn: expect.any(String) } });
  });

  it("treats a bad client id or an extra key as a tampered form", () => {
    expect(parseManualPayment({ clientId: "nope", amount: "1", paidOn: "2026-10-20" }, now)).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseManualPayment({ clientId, amount: "1", paidOn: "2026-10-20", status: "paid" }, now)).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parsePaymentTarget({ clientId, paymentId: "x" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("activationBlockers", () => {
  const ready = { status: "pending" as const, disabledAt: null, onboardingSubmittedAt: "2026-10-20T00:00:00Z", consentedAt: "2026-10-20T00:00:00Z" };

  it("is empty once the form is in and a payment is recorded", () => {
    expect(activationBlockers(ready, [{ status: "paid" }])).toEqual([]);
  });

  it("lists what's missing, and a voided payment doesn't count", () => {
    expect(activationBlockers({ ...ready, onboardingSubmittedAt: null, disabledAt: "x" }, [{ status: "void" }])).toEqual([
      "Enable the client first.",
      "Waiting for the client's onboarding form.",
      "Record their payment.",
    ]);
  });

  it("says an active client is already active", () => {
    expect(activationBlockers({ ...ready, status: "active" }, [])).toEqual(["The client is already active."]);
  });
});

describe("clientRegistrationSteps with progress", () => {
  it("ticks company, consent, payment and completion from the form, payments and activation", () => {
    const pending = progressOf({ status: "pending", onboardingSubmittedAt: "x", consentedAt: "x" }, [{ status: "paid" }]);
    expect(clientRegistrationSteps(emptyClientBusiness(), pending).map((step) => [step.id, step.done, step.current])).toEqual([
      ["registration", true, false],
      ["company", true, false],
      ["consent", true, false],
      ["payment", true, false],
      ["completed", false, true],
    ]);
    const active = progressOf({ status: "active", onboardingSubmittedAt: "x", consentedAt: "x" }, [{ status: "paid" }]);
    expect(clientRegistrationSteps(emptyClientBusiness(), active).every((step) => step.done)).toBe(true);
  });
});
