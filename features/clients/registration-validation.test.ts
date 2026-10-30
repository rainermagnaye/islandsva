import { describe, expect, it } from "vitest";
import { AGREEMENT_CHANGED, parseAgreementAcceptance, parsePaymentProofStep, parseRegistrationDetails } from "./registration-validation";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";
const fingerprint = "a".repeat(64);

describe("parseRegistrationDetails", () => {
  const details = {
    token,
    companyName: " Cruz Co ",
    contactName: " Ana Cruz ",
    contactPhone: "",
    industry: "Legal",
    country: "United States",
    website: "",
    jobTitle: "",
    street: "",
    city: " Austin ",
    state: "",
    zip: "",
    staffCount: "",
    about: " Inbox help. ",
  };

  it("trims the details and groups the business fields", () => {
    expect(parseRegistrationDetails(details)).toMatchObject({
      ok: true,
      value: { token, companyName: "Cruz Co", contactName: "Ana Cruz", contactPhone: null, business: { city: "Austin", about: "Inbox help.", country: "United States" } },
    });
  });

  it.each([
    ["companyName", { companyName: " " }, "Enter the company name."],
    ["contactName", { contactName: "" }, "Enter the contact's name."],
    ["industry", { industry: "Space" }, "Choose an industry."],
    ["country", { country: "Atlantis" }, "Choose a country."],
    ["city", { city: "" }, "Enter the city."],
    ["about", { about: "" }, "Describe the business."],
    ["contactPhone", { contactPhone: "1".repeat(41) }, expect.stringContaining("under 40")],
  ])("reports %s", (field, change, message) => {
    expect(parseRegistrationDetails({ ...details, ...change })).toMatchObject({ ok: false, fieldErrors: { [field]: message } });
  });

  it("treats a bad token or an unknown key as a tampered form", () => {
    expect(parseRegistrationDetails({ ...details, token: "short" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseRegistrationDetails({ ...details, signature: "x" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseAgreementAcceptance", () => {
  const form = { token, version: "v1", fingerprint, signerName: " Ana Cruz ", accept: "yes" };

  it("returns the trimmed name with the version and fingerprint", () => {
    expect(parseAgreementAcceptance(form)).toEqual({ ok: true, value: { token, version: "v1", fingerprint, signerName: "Ana Cruz" } });
  });

  it("needs a name of 1 to 120 characters with no control characters", () => {
    expect(parseAgreementAcceptance({ ...form, signerName: "  " })).toMatchObject({ ok: false, fieldErrors: { signerName: "Type your full name to sign." } });
    expect(parseAgreementAcceptance({ ...form, signerName: "a".repeat(121) })).toMatchObject({ ok: false, fieldErrors: { signerName: expect.stringContaining("under 120") } });
    expect(parseAgreementAcceptance({ ...form, signerName: "Ana\u0007" })).toMatchObject({ ok: false, fieldErrors: { signerName: expect.stringContaining("unusual") } });
  });

  it("needs the box ticked", () => {
    expect(parseAgreementAcceptance({ token, version: "v1", fingerprint, signerName: "Ana" })).toMatchObject({ ok: false, fieldErrors: { accept: expect.stringContaining("accept") } });
    expect(parseAgreementAcceptance({ ...form, accept: "no" })).toMatchObject({ ok: false, fieldErrors: { accept: expect.any(String) } });
  });

  it("an old version is a stale page: read it again", () => {
    expect(parseAgreementAcceptance({ ...form, version: "v0" })).toEqual({ ok: false, formError: AGREEMENT_CHANGED });
  });

  it("a bad token, fingerprint or an unknown key is a tampered form", () => {
    expect(parseAgreementAcceptance({ ...form, token: "x" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseAgreementAcceptance({ ...form, fingerprint: "zz" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseAgreementAcceptance({ ...form, terms: "{}" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parsePaymentProofStep", () => {
  const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

  it("accepts a PDF or image and cleans the stored name", () => {
    const proof = file("bank receipt!.PDF", "application/pdf");
    expect(parsePaymentProofStep({ token, proof })).toMatchObject({ ok: true, value: { token, file: proof, name: "bank receipt.pdf", type: "application/pdf" } });
  });

  it("refuses a missing, empty, too large or wrong-type file on the proof field", () => {
    expect(parsePaymentProofStep({ token })).toMatchObject({ ok: false, fieldErrors: { proof: "Upload proof of payment to continue." } });
    expect(parsePaymentProofStep({ token, proof: file("", "application/octet-stream", 0) })).toMatchObject({ ok: false, fieldErrors: { proof: "Upload proof of payment to continue." } });
    expect(parsePaymentProofStep({ token, proof: file("r.pdf", "application/pdf", 2_097_153) })).toMatchObject({ ok: false, fieldErrors: { proof: "Keep the payment proof under 2 MB." } });
    expect(parsePaymentProofStep({ token, proof: file("r.exe", "application/x-msdownload") })).toMatchObject({ ok: false, fieldErrors: { proof: "Use a PDF, JPG, PNG or WebP." } });
    expect(parsePaymentProofStep({ token, proof: "receipt.pdf" })).toMatchObject({ ok: false, fieldErrors: { proof: expect.any(String) } });
  });

  it("a bad token or an unknown key is a tampered form", () => {
    expect(parsePaymentProofStep({ token: "x", proof: file("r.pdf", "application/pdf") })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parsePaymentProofStep({ token, proof: file("r.pdf", "application/pdf"), extra: "1" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});
