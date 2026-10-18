import { describe, expect, it } from "vitest";
import { clientProfileTab, clientRegistrationSteps, companyDetailsComplete, emptyClientBusiness, type ClientBusiness } from "./contract";

const complete: ClientBusiness = {
  ...emptyClientBusiness(),
  industry: "Legal",
  country: "United States",
  city: "Austin",
  about: "Inbox and calendar.",
};

describe("client registration progress", () => {
  it("starts registration when the lead is converted, then waits on company details", () => {
    const steps = clientRegistrationSteps(emptyClientBusiness());
    expect(steps.find((step) => step.id === "registration")).toMatchObject({ done: true, current: false });
    expect(steps.find((step) => step.current)?.id).toBe("company");
  });

  it("moves to Consent once company details are in, and leaves payment for later", () => {
    expect(companyDetailsComplete(complete)).toBe(true);
    const steps = clientRegistrationSteps(complete);
    expect(steps.find((step) => step.id === "company")).toMatchObject({ done: true });
    expect(steps.find((step) => step.current)?.id).toBe("consent");
    expect(steps.find((step) => step.id === "payment")?.done).toBe(false);
    expect(steps.find((step) => step.id === "completed")?.done).toBe(false);
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
