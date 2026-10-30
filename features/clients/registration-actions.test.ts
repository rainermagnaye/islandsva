import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, FORM_ERROR, OUTAGE_MESSAGE } from "@/lib/validation";
import { AGREEMENT_CHANGED } from "./registration-validation";

// The registration link's actions: the parser is the real one; the services, the database, the request headers
// and Next's cache are replaced. A refusal becomes a fixed message; a parse failure never reaches the database.

const saveRegistrationDetails = vi.fn();
const acceptAgreement = vi.fn();
const saveRegistrationProofRow = vi.fn();
const hashIp = vi.fn();
const refresh = vi.fn();

vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));
vi.mock("@/lib/api/ip-hash", () => ({ hashIp: (ip: string | null) => hashIp(ip) }));
vi.mock("./service", () => ({
  saveRegistrationDetails: (...args: unknown[]) => saveRegistrationDetails(...args),
  acceptAgreement: (...args: unknown[]) => acceptAgreement(...args),
}));
vi.mock("./registration-dal", () => ({ saveRegistrationProofRow: (...args: unknown[]) => saveRegistrationProofRow(...args) }));

const { acceptAgreementAction, saveRegistrationDetailsAction, saveRegistrationProofAction } = await import("./registration-actions");

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";
const form = (fields: Record<string, string | File>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};
const details = { token, companyName: "Cruz Co", contactName: "Ana", contactPhone: "", industry: "Legal", country: "United States", website: "", jobTitle: "", street: "", city: "Austin", state: "", zip: "", staffCount: "", about: "Inbox help." };
const agreement = { token, version: "v1", fingerprint: "a".repeat(64), signerName: " Ana Cruz ", accept: "yes" };
const proof = () => ({ token, proof: new File([new Uint8Array([1, 2, 3])], "receipt.pdf", { type: "application/pdf" }) });

const NOT_OPEN = "This registration can't be changed now.";
type Case = [reason: string, message: string];
const refusals: Case[] = [
  ["not_found", "This registration link is not valid."],
  ["not_open", NOT_OPEN],
  ["closed", NOT_OPEN],
];

beforeEach(() => {
  for (const fn of [saveRegistrationDetails, acceptAgreement, saveRegistrationProofRow]) fn.mockReset().mockResolvedValue({ ok: true, status: "pending_customer" });
  hashIp.mockReset().mockResolvedValue("f".repeat(64));
  refresh.mockReset();
});

describe("saveRegistrationDetailsAction", () => {
  it("saves the parsed details and refreshes onto the next step", async () => {
    expect(await saveRegistrationDetailsAction(form(details))).toEqual({ ok: true });
    expect(saveRegistrationDetails).toHaveBeenCalledWith(expect.objectContaining({ token, companyName: "Cruz Co", business: expect.objectContaining({ city: "Austin" }) }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns field errors, or a form error for a bad token, without saving", async () => {
    expect(await saveRegistrationDetailsAction(form({ ...details, city: "" }))).toMatchObject({ ok: false, message: FIELD_ERRORS, fieldErrors: { city: "Enter the city." } });
    expect(await saveRegistrationDetailsAction(form({ ...details, token: "x" }))).toEqual({ ok: false, message: FORM_ERROR });
    expect(saveRegistrationDetails).not.toHaveBeenCalled();
  });

  it.each<Case>([...refusals, ["invalid", "Check the details and try again."]])("explains %s and doesn't refresh", async (reason, message) => {
    saveRegistrationDetails.mockResolvedValue({ ok: false, reason });
    expect(await saveRegistrationDetailsAction(form(details))).toEqual({ ok: false, message });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("turns an outage into a try-again message", async () => {
    saveRegistrationDetails.mockRejectedValue(new UpstreamError("supabase", "down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await saveRegistrationDetailsAction(form(details))).toEqual({ ok: false, message: OUTAGE_MESSAGE });
  });
});

describe("acceptAgreementAction", () => {
  it("passes the trimmed name and the hashed client IP, never the raw one", async () => {
    expect(await acceptAgreementAction(form(agreement))).toEqual({ ok: true });
    expect(hashIp).toHaveBeenCalledWith("203.0.113.7");
    expect(acceptAgreement).toHaveBeenCalledWith({ token, version: "v1", fingerprint: "a".repeat(64), signerName: "Ana Cruz" }, "f".repeat(64));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("needs the box ticked and a name; an old version is a stale page — nothing is saved", async () => {
    expect(await acceptAgreementAction(form({ ...agreement, accept: "" }))).toMatchObject({ ok: false, fieldErrors: { accept: expect.any(String) } });
    expect(await acceptAgreementAction(form({ ...agreement, signerName: " " }))).toMatchObject({ ok: false, fieldErrors: { signerName: expect.any(String) } });
    expect(await acceptAgreementAction(form({ ...agreement, version: "v0" }))).toEqual({ ok: false, message: AGREEMENT_CHANGED });
    expect(acceptAgreement).not.toHaveBeenCalled();
    expect(hashIp).not.toHaveBeenCalled();
  });

  it("turns an outage into a try-again message that leaks nothing", async () => {
    acceptAgreement.mockRejectedValue(new UpstreamError("supabase", "Accepting the agreement failed (XX000)"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await acceptAgreementAction(form(agreement));
    expect(result).toEqual({ ok: false, message: OUTAGE_MESSAGE });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(new RegExp(`${token}|Ana Cruz|203\\.0\\.113\\.7|f{64}`));
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each<Case>([
    ...refusals,
    ["changed", AGREEMENT_CHANGED],
    ["terms_missing", "Your package isn't set up yet. Contact your account manager."],
    ["invalid", "Check your name and try again."],
  ])("explains %s and doesn't refresh", async (reason, message) => {
    acceptAgreement.mockResolvedValue({ ok: false, reason });
    expect(await acceptAgreementAction(form(agreement))).toEqual({ ok: false, message });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("saveRegistrationProofAction", () => {
  it("sends the checked file as base64 and refreshes", async () => {
    expect(await saveRegistrationProofAction(form(proof()))).toEqual({ ok: true });
    expect(saveRegistrationProofRow).toHaveBeenCalledWith(token, { name: "receipt.pdf", type: "application/pdf", base64: "AQID" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses a wrong type, an oversized file or a bad token before reading or saving", async () => {
    const exe = new File([new Uint8Array([1])], "r.exe", { type: "application/x-msdownload" });
    expect(await saveRegistrationProofAction(form({ token, proof: exe }))).toMatchObject({ ok: false, fieldErrors: { proof: "Use a PDF, JPG, PNG or WebP." } });
    const big = new File([new Uint8Array(2_097_153)], "r.pdf", { type: "application/pdf" });
    expect(await saveRegistrationProofAction(form({ token, proof: big }))).toMatchObject({ ok: false, fieldErrors: { proof: "Keep the payment proof under 2 MB." } });
    expect(await saveRegistrationProofAction(form({ ...proof(), token: "x" }))).toEqual({ ok: false, message: FORM_ERROR });
    expect(saveRegistrationProofRow).not.toHaveBeenCalled();
  });

  it.each<Case>([...refusals, ["invalid", "Use a PDF, JPG, PNG or WebP, up to 2 MB."]])("explains %s and doesn't refresh", async (reason, message) => {
    saveRegistrationProofRow.mockResolvedValue({ ok: false, reason });
    expect(await saveRegistrationProofAction(form(proof()))).toEqual({ ok: false, message });
    expect(refresh).not.toHaveBeenCalled();
  });
});
