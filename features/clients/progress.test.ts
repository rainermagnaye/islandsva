import { describe, expect, it } from "vitest";
import { clientBadge, clientProfileTab, emptyClientBusiness, onboardingAccess, type ClientBusiness } from "./contract";
import { applyOpenSections, clientRegistrationSteps, clientReviewSections, openClientSections, revisionMessage } from "./registration";

const complete: ClientBusiness = {
  ...emptyClientBusiness(),
  industry: "Legal",
  country: "United States",
  city: "Austin",
  about: "Inbox and calendar.",
};

describe("client registration progress", () => {
  const base = { onboardingStatus: "pending_customer" as const, accountStatus: "pending" as const };

  it("starts on registration once the lead is converted", () => {
    const steps = clientRegistrationSteps({ ...base, onboardingStatus: "ready" });
    expect(steps.map((step) => step.label)).toEqual(["Converted", "Registration", "Review", "Activation", "Completed"]);
    expect(steps.find((step) => step.id === "converted")).toMatchObject({ done: true, current: false });
    expect(steps.find((step) => step.current)?.id).toBe("registration");
  });

  it("stays on registration while the customer still has the form", () => {
    const steps = clientRegistrationSteps(base);
    expect(steps.find((step) => step.id === "registration")).toMatchObject({ done: false, current: true });
    expect(steps.find((step) => step.id === "review")?.done).toBe(false);
  });

  it("waits on review once the form is in, and opens registration again when it is sent back", () => {
    const steps = clientRegistrationSteps({ ...base, onboardingStatus: "pending_review" });
    expect(steps.find((step) => step.id === "registration")).toMatchObject({ done: true });
    expect(steps.find((step) => step.current)?.id).toBe("review");
    expect(steps.find((step) => step.id === "activation")?.done).toBe(false);

    const returned = clientRegistrationSteps({ ...base, onboardingStatus: "changes_requested" });
    expect(returned.find((step) => step.id === "registration")).toMatchObject({ done: false, current: true });
  });

  it("moves to activation after review, and completes once the invite is sent", () => {
    const reviewed = clientRegistrationSteps({ ...base, onboardingStatus: "approved" });
    expect(reviewed.find((step) => step.id === "review")).toMatchObject({ done: true });
    expect(reviewed.find((step) => step.current)?.id).toBe("activation");

    const sent = clientRegistrationSteps({ ...base, onboardingStatus: "invite_sent" });
    expect(sent.find((step) => step.id === "activation")).toMatchObject({ done: true });
    expect(sent.every((step) => step.done)).toBe(true);
    expect(sent.find((step) => step.current)?.id).toBe("completed");
  });
});

describe("client status badge", () => {
  const pending = { status: "pending" as const, onboardingStatus: "pending_customer" as const, disabledAt: null };

  it("shows the packet status until the account is active", () => {
    expect(clientBadge(pending)).toMatchObject({ label: "Pending customer", tone: "info" });
    expect(clientBadge({ ...pending, onboardingStatus: "ready" })).toMatchObject({ label: "Ready" });
    expect(clientBadge({ ...pending, onboardingStatus: "approved" })).toMatchObject({ label: "Pending activation", tone: "warning" });
    expect(clientBadge({ ...pending, onboardingStatus: "invite_sent" })).toMatchObject({ label: "Pending activation" });
    expect(clientBadge({ status: "active", onboardingStatus: "ready", disabledAt: null })).toMatchObject({ label: "Active", tone: "success" });
    expect(clientBadge({ ...pending, disabledAt: "2026-10-24T00:00:00Z" })).toMatchObject({ label: "Disabled" });
  });

  it("keeps the public form open only while the customer still has the packet", () => {
    expect(onboardingAccess(pending)).toEqual({ closed: false, editable: true });
    expect(onboardingAccess({ ...pending, onboardingStatus: "pending_review" })).toEqual({ closed: false, editable: false });
    expect(onboardingAccess({ ...pending, onboardingStatus: "changes_requested" })).toEqual({ closed: false, editable: true });
    expect(onboardingAccess({ status: "inactive", onboardingStatus: "pending_customer", disabledAt: null })).toEqual({ closed: true, editable: false });
  });
});

describe("registration sent back", () => {
  const stored = {
    companyName: "Cruz Co",
    contactName: "Ana",
    contactPhone: null,
    business: complete,
    consentName: "Ana",
    paymentProofName: "receipt.pdf",
    reviewIssues: ["address"] as const,
  };

  it("names the sections and keeps the note", () => {
    expect(clientReviewSections("{basic,address}")).toEqual(["basic", "address"]);
    expect(revisionMessage(["basic", "address"], " City is wrong ")).toBe("Please update Basic info and Address. City is wrong");
    expect(revisionMessage(["payment"], null)).toBe("Please update Payment.");
  });

  it("opens every section the first time, and only the returned ones after", () => {
    expect(openClientSections({ ...stored, reviewIssues: [] })).toEqual(["basic", "address", "contacts", "package", "consent", "payment"]);
    expect(openClientSections(stored)).toEqual(["address"]);
    expect(openClientSections({ ...stored, reviewIssues: ["basic"], paymentProofName: null })).toEqual(["basic", "payment"]);
  });

  it("keeps the sections that were not sent back", () => {
    const submitted = {
      token: "t",
      companyName: "Changed",
      contactName: "Changed",
      contactPhone: "1",
      consentName: "Changed",
      business: { ...complete, city: "Dallas", about: "Changed" },
    };
    const kept = applyOpenSections(submitted, stored, ["address"]);
    expect(kept.companyName).toBe("Cruz Co");
    expect(kept.contactName).toBe("Ana");
    expect(kept.consentName).toBe("Ana");
    expect(kept.business.city).toBe("Dallas");
    expect(kept.business.about).toBe(complete.about);
  });
});

describe("client profile tabs", () => {
  it("keeps overview unless the tab is consents or invoices", () => {
    expect(clientProfileTab(undefined)).toBe("overview");
    expect(clientProfileTab("notes")).toBe("notes");
    expect(clientProfileTab("consents")).toBe("consents");
    expect(clientProfileTab(["invoices"])).toBe("invoices");
    expect(clientProfileTab("payment")).toBe("overview");
  });
});
