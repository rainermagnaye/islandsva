import { describe, expect, it } from "vitest";
import { openRegistrationSteps, registrationIssues } from "./registration";

const complete = {
  companyName: "Acme",
  contactName: "Nia",
  business: { industry: "Legal", country: "United States", city: "Austin", about: "Inbox" },
  reviewIssues: [] as string[],
  agreementCurrent: true,
  termsMissing: false,
  hasProof: true,
};

describe("openRegistrationSteps (mirrors private.packet_open_sections)", () => {
  it("first visit: every step is open", () => {
    const first = { ...complete, business: { industry: "", country: "", city: "", about: "" }, agreementCurrent: false, hasProof: false };
    expect(openRegistrationSteps(first)).toEqual(["details", "agreement", "payment"]);
  });

  it("nothing open once all three are done", () => {
    expect(openRegistrationSteps(complete)).toEqual([]);
  });

  it.each([
    ["basic", "details"],
    ["address", "details"],
    ["contacts", "details"],
    ["package", "agreement"],
    ["consent", "agreement"],
    ["agreement", "agreement"],
    ["payment", "payment"],
  ])("a sent-back %s opens %s", (section, step) => {
    expect(openRegistrationSteps({ ...complete, reviewIssues: [section] })).toEqual([step]);
  });

  it("keeps the step order and ignores unknown sections", () => {
    expect(openRegistrationSteps({ ...complete, reviewIssues: ["payment", "address", "toString", "nope"] })).toEqual(["details", "payment"]);
  });

  it("details are open while a required field is empty or too long", () => {
    expect(openRegistrationSteps({ ...complete, business: { ...complete.business, city: "  " } })).toEqual(["details"]);
    expect(openRegistrationSteps({ ...complete, companyName: "x".repeat(161) })).toEqual(["details"]);
    expect(openRegistrationSteps({ ...complete, business: { ...complete.business, about: "x".repeat(2001) } })).toEqual(["details"]);
  });

  it("the agreement is open without an acceptance of the current terms, or while the terms are unset", () => {
    expect(openRegistrationSteps({ ...complete, agreementCurrent: false })).toEqual(["agreement"]);
    expect(openRegistrationSteps({ ...complete, termsMissing: true })).toEqual(["agreement"]);
  });

  it("payment is open without a proof", () => {
    expect(openRegistrationSteps({ ...complete, hasProof: false })).toEqual(["payment"]);
  });
});

describe("registrationIssues", () => {
  it("keeps the database's section names, from an array or Postgres array text", () => {
    expect(registrationIssues(["basic", "agreement", "x"])).toEqual(["basic", "agreement"]);
    expect(registrationIssues('{address,"payment",constructor}')).toEqual(["address", "payment"]);
    expect(registrationIssues(null)).toEqual([]);
  });
});
