import { describe, expect, it } from "vitest";
import { isOnboardingToken, parseOnboarding } from "./onboarding-validation";

const token = "a".repeat(43);
const form = {
  token,
  contactName: " Ana Cruz ",
  contactPhone: "",
  jobTitle: "Founder",
  industry: "Legal",
  website: "",
  staffCount: "Just me",
  about: " Inbox and calendar. ",
  street: "",
  city: " Austin ",
  state: "TX",
  zip: "",
  country: "United States",
  billingName: "Cruz Co",
  billingEmail: " Billing@Cruz.co ",
  billingStreet: "",
  billingCity: "",
  billingState: "",
  billingZip: "",
  billingCountry: "",
  billingTaxId: "",
  consent: true,
};

describe("parseOnboarding", () => {
  it("splits the form into contact, company and billing details, trimmed", () => {
    expect(parseOnboarding(form)).toEqual({
      ok: true,
      value: {
        token,
        contactName: "Ana Cruz",
        contactPhone: "",
        business: { industry: "Legal", country: "United States", website: "", jobTitle: "Founder", street: "", city: "Austin", state: "TX", zip: "", staffCount: "Just me", about: "Inbox and calendar." },
        billing: { name: "Cruz Co", email: "billing@cruz.co", street: "", city: "", state: "", zip: "", country: "", taxId: "" },
      },
    });
  });

  it("needs consent, and only a real true counts", () => {
    expect(parseOnboarding({ ...form, consent: false })).toMatchObject({ ok: false, fieldErrors: { consent: expect.any(String) } });
    expect(parseOnboarding({ ...form, consent: "true" })).toMatchObject({ ok: false, fieldErrors: { consent: expect.any(String) } });
  });

  it("needs the company details the team works from, and a billing name and email", () => {
    expect(parseOnboarding({ ...form, industry: "", city: " ", about: "", country: "Atlantis", billingName: "", billingEmail: "x@" })).toMatchObject({
      ok: false,
      fieldErrors: { industry: expect.any(String), city: expect.any(String), about: expect.any(String), country: expect.any(String), billingName: expect.any(String), billingEmail: expect.any(String) },
    });
  });

  it("treats a bad token or an extra key as a tampered request, not a field error", () => {
    expect(parseOnboarding({ ...form, token: "short" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseOnboarding({ ...form, contactEmail: "other@x.co" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseOnboarding([])).toMatchObject({ ok: false, formError: expect.any(String) });
  });

  it("keeps every field within its limit and free of control characters", () => {
    expect(parseOnboarding({ ...form, billingTaxId: "x".repeat(41), billingName: "A\u0007B", about: "x".repeat(2001) })).toMatchObject({
      ok: false,
      fieldErrors: { billingTaxId: expect.any(String), billingName: expect.any(String), about: expect.any(String) },
    });
  });
});

describe("isOnboardingToken", () => {
  it("accepts only the exact token shape", () => {
    expect(isOnboardingToken(token)).toBe(true);
    expect(isOnboardingToken(`${token}x`)).toBe(false);
    expect(isOnboardingToken("../../admin")).toBe(false);
    expect(isOnboardingToken(undefined)).toBe(false);
  });
});
