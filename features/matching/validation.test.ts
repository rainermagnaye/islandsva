import { describe, expect, it } from "vitest";
import { FORM_ERROR } from "@/lib/validation";
import { parseDecision, parseHours, parseOffer, parseWithdraw } from "./validation";

const clientId = "00000000-0000-4000-8000-000000000001";
const vaId = "00000000-0000-4000-8000-000000000002";
const shortlistId = "00000000-0000-4000-8000-000000000003";

describe("matching validation", () => {
  it("accepts an offer and rejects extra keys", () => {
    expect(parseOffer({ clientId, vaId })).toEqual({ ok: true, value: { clientId, vaId } });
    expect(parseOffer({ clientId, vaId, note: "x" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseOffer({ clientId, vaId: "nope" })).toMatchObject({ ok: false, fieldErrors: { vaId: "Choose a VA." } });
  });

  it("accepts a decision of accepted or declined", () => {
    expect(parseDecision({ shortlistId, status: "accepted" })).toEqual({ ok: true, value: { shortlistId, status: "accepted" } });
    expect(parseDecision({ shortlistId, status: "offered" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseWithdraw({ shortlistId })).toEqual({ ok: true, value: { shortlistId } });
  });

  it("accepts a half-hour window and rejects one that ends too early", () => {
    expect(parseHours({ weekday: "1", startMinute: "540", endMinute: "1020" })).toEqual({
      ok: true,
      value: { weekday: 1, startMinute: 540, endMinute: 1020 },
    });
    expect(parseHours({ weekday: "1", startMinute: "540", endMinute: "540" })).toMatchObject({
      ok: false,
      fieldErrors: { endMinute: "End the window after it starts." },
    });
    expect(parseHours({ weekday: "1", startMinute: "545", endMinute: "600" })).toMatchObject({ ok: false, fieldErrors: { startMinute: expect.any(String) } });
  });
});
