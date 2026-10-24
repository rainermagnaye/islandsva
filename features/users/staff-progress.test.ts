import { describe, expect, it } from "vitest";
import { emptyStaffDetails, openReviewSections, registrationStatus, registrationSteps, staffAccessBadge, staffSections, vaPortalOpen } from "./contract";

describe("staff registration progress", () => {
  it("starts pending", () => {
    expect(registrationStatus(staffSections(emptyStaffDetails("Ada")))).toBe("pending");
  });

  it("is in progress once a section is filled", () => {
    const details = emptyStaffDetails("Ada");
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    expect(staffSections(details).basic).toBe(true);
    expect(registrationStatus(staffSections(details))).toBe("in_progress");
  });

  it("walks the stepper from the invitation to registration", () => {
    const steps = registrationSteps(staffSections(emptyStaffDetails("Ada")), { signedIn: true, review: "pending", returned: [] });
    expect(steps.map((step) => step.label)).toEqual(["Invitation sent", "Password", "Registration", "Review", "Completed"]);
    expect(steps.find((step) => step.current)?.id).toBe("registration");
    expect(steps[0]).toMatchObject({ done: true, current: false });
    expect(steps[1]).toMatchObject({ id: "password", done: true });
  });

  it("stops on the password until they sign in, and opens registration again when a section is sent back", () => {
    const waiting = registrationSteps(staffSections(emptyStaffDetails("Ada")), { signedIn: false, review: "pending", returned: [] });
    expect(waiting.find((step) => step.current)?.id).toBe("password");

    const details = emptyStaffDetails("Ada");
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    details.currentStreet = "1 Beach Road";
    details.currentCity = "Cebu";
    details.currentProvince = "Cebu";
    details.currentPostalCode = "6000";
    details.mobileNumber = "09170000000";
    details.emergencyName = "Mia";
    details.emergencyRelationship = "Sister";
    details.emergencyPhone = "09170000001";
    details.resumeName = "ada.pdf";
    details.employers = [{ company: "North", position: "VA", duration: "" }];
    details.keyResponsibilities = "Inbox and calendar";
    details.references = [{ name: "Ana Cruz", email: "ana@x.co", phone: "0917", company: "North", relationship: "Manager" }];
    const returned = registrationSteps(staffSections(details), { signedIn: true, review: "pending", returned: ["basic"] });
    expect(returned.find((step) => step.id === "registration")).toMatchObject({ done: false, current: true });
  });

  it("keeps experiences open until the work history includes a reference", () => {
    const details = emptyStaffDetails("Ada");
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    details.currentStreet = "1 Beach Road";
    details.currentCity = "Cebu";
    details.currentProvince = "Cebu";
    details.currentPostalCode = "6000";
    details.mobileNumber = "09170000000";
    details.emergencyName = "Mia";
    details.emergencyRelationship = "Sister";
    details.emergencyPhone = "09170000001";
    details.resumeName = "ada.pdf";
    const open = staffSections(details);
    const filling = { signedIn: true, review: "pending" as const, returned: [] };
    expect(registrationStatus(open)).toBe("in_progress");
    expect(registrationSteps(open, filling).find((step) => step.current)?.id).toBe("registration");

    details.employers = [{ company: "North", position: "VA", duration: "" }];
    details.keyResponsibilities = "Inbox and calendar";
    details.references = [{ name: "Ana Cruz", email: "ana@x.co", phone: "0917", company: "North", relationship: "Manager" }];
    const done = staffSections(details);
    expect(done.experience).toBe(true);
    expect(registrationStatus(done)).toBe("completed");
    const steps = registrationSteps(done, filling);
    expect(steps.find((step) => step.current)?.id).toBe("review");
    const confirmed = registrationSteps(done, { signedIn: true, review: "approved", returned: [] });
    expect(confirmed.every((step) => step.done)).toBe(true);
    expect(confirmed.find((step) => step.current)?.id).toBe("completed");
  });
});

describe("VA portal access", () => {
  const va = ["va"] as const;

  it("stays closed until an admin confirms, and a confirmed VA is Active", () => {
    expect(vaPortalOpen("invited", null)).toBe(false);
    expect(vaPortalOpen("invited", "pending")).toBe(false);
    expect(vaPortalOpen("invited", "pending_review")).toBe(false);
    expect(vaPortalOpen("active", "approved")).toBe(true);
    expect(vaPortalOpen("active", null)).toBe(true);
    expect(vaPortalOpen("inactive", "approved")).toBe(false);
    expect(staffAccessBadge({ roles: va, accountStatus: "invited", review: null, signedIn: false }).label).toBe("Invited");
    expect(staffAccessBadge({ roles: va, accountStatus: "invited", review: "pending", signedIn: true })).toMatchObject({ label: "Pending", validated: false });
    expect(staffAccessBadge({ roles: va, accountStatus: "invited", review: "pending_review", signedIn: true }).label).toBe("Pending Review");
    expect(staffAccessBadge({ roles: va, accountStatus: "active", review: "approved", signedIn: true })).toMatchObject({ label: "Active", validated: true });
  });

  it("leaves Closers and admins on the account status", () => {
    expect(staffAccessBadge({ roles: ["closer"], accountStatus: "active", review: null, signedIn: true })).toMatchObject({ label: "Active", validated: false });
    expect(staffAccessBadge({ roles: ["admin", "va"], accountStatus: "active", review: "pending", signedIn: true }).label).toBe("Active");
  });

  it("shows a flagged section again, and any section that is still empty", () => {
    const details = emptyStaffDetails("Ada");
    expect(openReviewSections(staffSections(details), ["contact"])).toEqual(["basic", "address", "contact", "skills", "experience"]);
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    details.currentStreet = "1 Beach Road";
    details.currentCity = "Cebu";
    details.currentProvince = "Cebu";
    details.currentPostalCode = "6000";
    details.mobileNumber = "09170000000";
    details.emergencyName = "Mia";
    details.emergencyRelationship = "Sister";
    details.emergencyPhone = "09170000001";
    details.highestEducation = "Bachelor's";
    details.skills = "Inbox";
    details.languages = "English";
    details.resumeName = "ada.pdf";
    details.employers = [{ company: "North", position: "VA", duration: "" }];
    details.keyResponsibilities = "Inbox and calendar";
    details.references = [{ name: "Ana Cruz", email: "ana@x.co", phone: "0917", company: "North", relationship: "Manager" }];
    expect(openReviewSections(staffSections(details), ["contact"])).toEqual(["contact"]);
  });

  it("keeps registration open until every section is valid", () => {
    const details = emptyStaffDetails("Ada");
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    details.mobileNumber = "09170000000";
    details.emergencyName = "Mia";
    details.emergencyRelationship = "Sister";
    details.emergencyPhone = "09170000001";
    const steps = registrationSteps(staffSections(details), { signedIn: true, review: "pending", returned: [] });
    expect(steps.find((step) => step.id === "registration")).toMatchObject({ done: false, current: true });

    details.dateOfBirth = "2099-01-01";
    expect(staffSections(details).basic).toBe(false);

    details.dateOfBirth = "1990-01-01";
    details.employers = [{ company: "North", position: "VA", duration: "" }];
    details.keyResponsibilities = "Inbox and calendar";
    details.references = [{ name: "Ana Cruz", email: "not-an-email", phone: "0917", company: "North", relationship: "Manager" }];
    expect(staffSections(details).experience).toBe(false);
    expect(registrationSteps(staffSections(details), { signedIn: true, review: "pending", returned: [] }).find((step) => step.id === "registration")?.done).toBe(false);
  });
});
