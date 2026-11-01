import { describe, expect, it } from "vitest";
import { canSeeRegistrationLink } from "./link-access";

const client = { createdById: "closer-1" };

describe("canSeeRegistrationLink", () => {
  it("lets the Lead Gen who created the client see the link", () => {
    expect(canSeeRegistrationLink({ id: "closer-1", roles: ["closer"] }, client)).toBe(true);
  });

  it("hides the link from another Lead Gen in the same agency", () => {
    expect(canSeeRegistrationLink({ id: "closer-2", roles: ["closer"] }, client)).toBe(false);
  });

  it("lets any admin see the link, with or without the Lead Gen role", () => {
    expect(canSeeRegistrationLink({ id: "admin-1", roles: ["admin"] }, client)).toBe(true);
    expect(canSeeRegistrationLink({ id: "admin-1", roles: ["admin", "closer"] }, client)).toBe(true);
  });

  it("hides the link from other roles", () => {
    expect(canSeeRegistrationLink({ id: "va-1", roles: ["va"] }, client)).toBe(false);
    expect(canSeeRegistrationLink({ id: "client-1", roles: ["client"] }, client)).toBe(false);
  });
});
