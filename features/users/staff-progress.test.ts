import { describe, expect, it } from "vitest";
import { emptyStaffDetails, registrationStatus, registrationSteps, staffSections } from "./contract";

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

  it("walks the stepper from the invitation to the first open step", () => {
    const steps = registrationSteps(staffSections(emptyStaffDetails("Ada")));
    expect(steps.map((step) => step.id)).toEqual(["invitation", "basic", "address", "contact", "skills", "completed"]);
    expect(steps.find((step) => step.current)?.id).toBe("basic");
    expect(steps[0]).toMatchObject({ done: true, current: false });
  });

  it("marks every step done once skills or a résumé complete the profile", () => {
    const details = emptyStaffDetails("Ada");
    details.dateOfBirth = "1990-01-01";
    details.gender = "female";
    details.nationality = "Filipino";
    details.maritalStatus = "single";
    details.currentStreet = "1 Beach Road";
    details.currentCity = "Cebu";
    details.currentProvince = "Cebu";
    details.currentPostalCode = "6000";
    details.permanentStreet = "1 Beach Road";
    details.permanentCity = "Cebu";
    details.permanentProvince = "Cebu";
    details.permanentPostalCode = "6000";
    details.mobileNumber = "09170000000";
    details.emergencyName = "Mia";
    details.emergencyRelationship = "Sister";
    details.emergencyPhone = "09170000001";
    details.resumeName = "ada.pdf";
    const sections = staffSections(details);
    expect(registrationStatus(sections)).toBe("completed");
    const steps = registrationSteps(sections);
    expect(steps.every((step) => step.done)).toBe(true);
    expect(steps.find((step) => step.current)?.id).toBe("completed");
  });
});
