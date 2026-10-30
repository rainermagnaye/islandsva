import { describe, expect, it } from "vitest";
import { AGREEMENTS, CURRENT_AGREEMENT_VERSION } from "@/content/agreement";
import { agreementMissingTerms, agreementTerms, agreementTermsFrom, renderAgreement, sameAgreementTerms, type AgreementTerms } from "./agreement";
import { agreementHash } from "./agreement-hash";

const client = {
  companyName: "Acme Legal",
  countryOnFile: "United States",
  packageCode: "essentials",
  hoursPerWeek: 20,
  termMonths: 6,
  monthlyCents: 85500,
  startsOn: "2026-11-01",
};
const terms = agreementTerms(client);

describe("agreementTerms", () => {
  it("uses the database snapshot's keys and value types", () => {
    expect(terms).toEqual({
      company_name: "Acme Legal",
      country: "United States",
      package_code: "essentials",
      hours_per_week: 20,
      term_months: 6,
      monthly_cents: 85500,
      starts_on: "2026-11-01",
    });
  });

  it("keeps unset values null, never empty strings or zero", () => {
    const bare = agreementTerms({ ...client, countryOnFile: null, packageCode: null, hoursPerWeek: null, termMonths: null, monthlyCents: null, startsOn: null });
    expect(bare).toEqual({ company_name: "Acme Legal", country: null, package_code: null, hours_per_week: null, term_months: null, monthly_cents: null, starts_on: null });
  });

  it("reads a stored snapshot back and compares key by key", () => {
    expect(agreementTermsFrom(JSON.parse(JSON.stringify(terms)))).toEqual(terms);
    expect(agreementTermsFrom(null)).toBeNull();
    expect(agreementTermsFrom([1])).toBeNull();
    expect(sameAgreementTerms(terms, { ...terms })).toBe(true);
    expect(sameAgreementTerms(terms, { ...terms, monthly_cents: 90000 })).toBe(false);
    expect(sameAgreementTerms(terms, { ...terms, country: "" })).toBe(false);
  });
});

describe("agreementMissingTerms", () => {
  it("is false with every term set; an empty country is allowed", () => {
    expect(agreementMissingTerms(terms)).toBe(false);
    expect(agreementMissingTerms({ ...terms, country: null })).toBe(false);
  });

  it.each(["package_code", "monthly_cents", "term_months", "hours_per_week", "starts_on"] as const)("is true without %s", (key) => {
    expect(agreementMissingTerms({ ...terms, [key]: null } as AgreementTerms)).toBe(true);
  });
});

describe("renderAgreement", () => {
  it("fills every placeholder with fixed formatting", () => {
    const text = renderAgreement("v1", terms);
    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain("Islands VA and Acme Legal (United States)");
    expect(text).toContain("Package: Essentials, 20 hours a week.");
    expect(text).toContain("Term: 6 months.");
    expect(text).toContain("Price: USD 855.00 a month.");
    expect(text).toContain("Start date: 2026-11-01.");
    expect(text).toContain("sample pending legal review");
  });

  it("formats large amounts and a one-month term, and marks unset values", () => {
    const text = renderAgreement("v1", { ...terms, monthly_cents: 300005, term_months: 1, country: null, starts_on: null });
    expect(text).toContain("Price: USD 3,000.05 a month.");
    expect(text).toContain("Term: 1 month.");
    expect(text).toContain("Acme Legal ((not set))");
    expect(text).toContain("Start date: (not set).");
  });

  it("is deterministic and NFC-normalised", () => {
    const decomposed = { ...terms, company_name: "Café Co" };
    const text = renderAgreement("v1", decomposed);
    expect(text).toBe(renderAgreement("v1", { ...decomposed }));
    expect(text).toBe(text.normalize("NFC"));
    expect(text).toContain("Café Co");
  });

  it("the current version exists", () => {
    expect(AGREEMENTS[CURRENT_AGREEMENT_VERSION]).toBeDefined();
  });

  // A published version never changes: the acceptance stores the text and its version. Edit wording as a new version.
  it("pins each published version's text", () => {
    expect(agreementHash(renderAgreement("v1", terms))).toBe("e80bddca83f1a90a522422afaea237782c24a58a5db92e47c490e802dcd56ca5");
  });
});
