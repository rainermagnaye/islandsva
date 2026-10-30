import { beforeEach, describe, expect, it, vi } from "vitest";
import { agreementTerms, renderAgreement } from "./agreement";
import { agreementHash } from "./agreement-hash";

// acceptAgreement builds the terms and the text on the server. A stale page (another version, or a fingerprint of
// other text) stores nothing, and the database only ever receives the server's render and snapshot.

const registration = vi.hoisted(() => ({
  getRegistrationState: vi.fn(),
  acceptClientAgreementRow: vi.fn(),
  getAgreementEvidence: vi.fn(),
  saveRegistrationDetailsRow: vi.fn(),
  saveRegistrationProofRow: vi.fn(),
}));
const dal = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("./registration-dal", () => registration);
vi.mock("./dal", () => dal);
vi.mock("./onboarding-dal", () => ({}));
vi.mock("./link", () => ({}));
vi.mock("@/features/users/service", () => ({}));

const { acceptAgreement, agreementEvidenceFor } = await import("./service");

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";
const terms = agreementTerms({ companyName: "Acme", countryOnFile: "United States", packageCode: "essentials", hoursPerWeek: 20, termMonths: 6, monthlyCents: 85500, startsOn: "2026-11-01" });
const text = renderAgreement("v1", terms);
const input = { token, version: "v1", fingerprint: agreementHash(text), signerName: "Ana" };

describe("acceptAgreement", () => {
  beforeEach(() => {
    registration.getRegistrationState.mockReset().mockResolvedValue({ terms });
    registration.acceptClientAgreementRow.mockReset().mockResolvedValue({ ok: true, status: "pending_customer" });
  });

  it("sends the server's own text and terms", async () => {
    expect(await acceptAgreement(input, "f".repeat(64))).toEqual({ ok: true, status: "pending_customer" });
    expect(registration.acceptClientAgreementRow).toHaveBeenCalledWith({ token, version: "v1", body: text, termsSeen: terms, signerName: "Ana", ipHash: "f".repeat(64) });
  });

  it("refuses a page that showed other text, without calling the database", async () => {
    // The Closer changed the price after the page loaded: the fingerprint no longer matches.
    registration.getRegistrationState.mockResolvedValue({ terms: { ...terms, monthly_cents: 90000 } });
    expect(await acceptAgreement(input, null)).toMatchObject({ ok: false, reason: "changed" });
    expect(registration.acceptClientAgreementRow).not.toHaveBeenCalled();
  });

  it("refuses another version, without calling the database", async () => {
    expect(await acceptAgreement({ ...input, version: "v0" }, null)).toMatchObject({ ok: false, reason: "changed" });
    expect(registration.acceptClientAgreementRow).not.toHaveBeenCalled();
  });

  it("refuses an unknown link and unset terms", async () => {
    registration.getRegistrationState.mockResolvedValue(null);
    expect(await acceptAgreement(input, null)).toEqual({ ok: false, reason: "not_found" });
    registration.getRegistrationState.mockResolvedValue({ terms: { ...terms, package_code: null } });
    expect(await acceptAgreement(input, null)).toEqual({ ok: false, reason: "terms_missing" });
    expect(registration.acceptClientAgreementRow).not.toHaveBeenCalled();
  });
});

describe("agreementEvidenceFor", () => {
  it("reads the evidence only for a client the caller can read under RLS", async () => {
    registration.getAgreementEvidence.mockReset().mockResolvedValue([]);
    dal.getClient.mockResolvedValueOnce(null);
    expect(await agreementEvidenceFor("c1")).toBeNull();
    expect(registration.getAgreementEvidence).not.toHaveBeenCalled();
    dal.getClient.mockResolvedValueOnce({ id: "c1" });
    expect(await agreementEvidenceFor("c1")).toEqual([]);
    expect(registration.getAgreementEvidence).toHaveBeenCalledWith("c1");
  });
});
