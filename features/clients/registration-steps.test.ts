import { describe, expect, it } from "vitest";
import { REGISTRATION_STEPS, REVIEW_SECTION_FOR_STEP, openRegistrationSteps, registrationIssues, registrationView, reviewIssueLabels, reviewIssueSteps } from "./registration";

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

describe("registrationView", () => {
  const view = (accountStatus: "pending" | "active" | "inactive", onboardingStatus: Parameters<typeof registrationView>[0]["onboardingStatus"], openSteps = 1, disabledAt: string | null = null) =>
    registrationView({ accountStatus, onboardingStatus, disabledAt, openSteps });

  it("shows the steps while the packet is with the customer", () => {
    expect(view("pending", "pending_customer")).toBe("steps");
    expect(view("pending", "changes_requested")).toBe("steps");
    expect(view("pending", "ready")).toBe("steps");
  });

  it("shows the read-only receipt only while the team reviews it", () => {
    expect(view("pending", "pending_review", 0)).toBe("receipt");
  });

  it("holds no client data once approved, invited or active", () => {
    expect(view("pending", "approved", 0)).toBe("complete");
    expect(view("pending", "invite_sent", 0)).toBe("complete");
    expect(view("active", "invite_sent", 0)).toBe("complete");
    expect(view("active", "pending_review", 0)).toBe("complete");
  });

  it("is closed for a disabled or inactive client, whatever the packet", () => {
    expect(view("pending", "pending_customer", 1, "2026-10-30T00:00:00Z")).toBe("closed");
    expect(view("pending", "pending_review", 0, "2026-10-30T00:00:00Z")).toBe("closed");
    expect(view("inactive", "invite_sent", 0)).toBe("closed");
  });

  it("with the customer but nothing open, says it's on its way without showing data", () => {
    expect(view("pending", "pending_customer", 0)).toBe("processing");
  });
});

describe("review sections: the admin's three steps and what is stored", () => {
  it("stores each step under a name save_client_review accepts, never `agreement`", () => {
    expect(REVIEW_SECTION_FOR_STEP).toEqual({ details: "basic", agreement: "consent", payment: "payment" });
    expect(Object.values(REVIEW_SECTION_FOR_STEP)).not.toContain("agreement");
  });

  it("reads every stored name back as its step, so the round trip is the identity", () => {
    for (const step of REGISTRATION_STEPS) expect(reviewIssueSteps([REVIEW_SECTION_FOR_STEP[step]])).toEqual([step]);
    expect(reviewIssueSteps(["address", "contacts", "package", "agreement"])).toEqual(["details", "agreement"]);
  });

  it("labels stored sections, old names included, under the new step names, once each and in order", () => {
    expect(reviewIssueLabels(["payment", "consent", "basic"])).toEqual(["Details", "Agreement", "Payment proof"]);
    expect(reviewIssueLabels(["address", "contacts", "package"])).toEqual(["Details", "Agreement"]);
    expect(reviewIssueLabels(["unknown"])).toEqual([]);
  });
});
