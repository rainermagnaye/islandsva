import { describe, expect, it } from "vitest";
import { acceptPaymentProof } from "./payment-proof";

describe("acceptPaymentProof", () => {
  it("keeps a pdf and rejects a recording", () => {
    expect(acceptPaymentProof({ name: "Receipt.pdf", type: "application/pdf", size: 12 })).toEqual({
      ok: true,
      name: "Receipt.pdf",
      type: "application/pdf",
    });
    expect(acceptPaymentProof({ name: "call.mp3", type: "audio/mpeg", size: 12 })).toMatchObject({ ok: false });
  });

  it("rejects a file over 2 MB", () => {
    expect(acceptPaymentProof({ name: "receipt.pdf", type: "application/pdf", size: 2_097_153 })).toMatchObject({
      ok: false,
      message: "Keep the payment proof under 2 MB.",
    });
  });
});