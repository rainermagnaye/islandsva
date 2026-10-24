import { describe, expect, it } from "vitest";
import { USER_LIMITS } from "./contract";
import { parseInvite, parseReferences, parseStaffDetails, parseStaffId } from "./validation";

const valid = { email: " Vi@Islandsva.com ", fullName: " Vi Santos ", role: "va" };

describe("parseInvite", () => {
  it("accepts a staff invite and normalises it", () => {
    expect(parseInvite(valid)).toEqual({ ok: true, value: { email: "vi@islandsva.com", fullName: "Vi Santos", role: "va" } });
  });

  it.each(["va", "closer", "admin"])("allows the %s role", (role) => {
    expect(parseInvite({ ...valid, role }).ok).toBe(true);
  });

  it("refuses the client role (clients are invited by a Closer) and unknown roles", () => {
    for (const role of ["client", "owner", ""]) {
      expect(parseInvite({ ...valid, role })).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    }
  });

  it("enforces the name limit and rejects control characters", () => {
    expect(parseInvite({ ...valid, fullName: "a".repeat(USER_LIMITS.fullName) }).ok).toBe(true);
    expect(parseInvite({ ...valid, fullName: "a".repeat(USER_LIMITS.fullName + 1) }).ok).toBe(false);
    expect(parseInvite({ ...valid, fullName: "Vi\u0000" }).ok).toBe(false);
  });

  it("rejects unknown keys as a form-level error", () => {
    expect(parseInvite({ ...valid, grantedBy: "me" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseStaffId", () => {
  it("accepts a user id", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(parseStaffId({ userId })).toEqual({ ok: true, value: { userId } });
  });

  it("rejects anything that is not an id", () => {
    expect(parseStaffId({ userId: "me" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseStaffId({ userId: "11111111-1111-4111-8111-111111111111", extra: true })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseReferences", () => {
  it("keeps a filled person and drops a blank row", () => {
    expect(parseReferences([" Ana Cruz ", ""], ["0917", ""], [" Manager ", ""], ["North", ""], [" Ana@X.co ", ""])).toEqual({
      ok: true,
      value: [{ name: "Ana Cruz", phone: "0917", relationship: "Manager", company: "North", email: "ana@x.co" }],
    });
  });

  it("refuses a fourth person and an incomplete email", () => {
    expect(parseReferences(["a", "b", "c", "d"], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]).ok).toBe(false);
    expect(parseReferences(["Ana"], [""], [""], [""], ["not-an-email"]).ok).toBe(false);
  });
});

describe("parseStaffDetails — date of birth", () => {
  const blank = {
    fullName: "Vi Santos", dateOfBirth: "", gender: "", nationality: "", maritalStatus: "",
    currentStreet: "", currentLine2: "", currentCity: "", currentProvince: "", currentPostalCode: "", currentCountry: "",
    mobileNumber: "", alternatePhone: "", emergencyName: "", emergencyRelationship: "", emergencyPhone: "",
    highestEducation: "", certifications: "", skills: "", languages: "", keyResponsibilities: "", achievements: "",
  };
  const withDate = (dateOfBirth: string) => parseStaffDetails({ ...blank, dateOfBirth });

  it("accepts a real past date, a leap day, or no date", () => {
    for (const date of ["1990-07-15", "2000-02-29", ""]) expect(withDate(date).ok).toBe(true);
  });

  it("rejects dates that look right but don't exist (the database would refuse them)", () => {
    for (const date of ["2026-02-31", "1990-13-01", "2001-02-29", "1990-04-31"]) {
      expect(withDate(date)).toMatchObject({ ok: false, fieldErrors: { dateOfBirth: "Enter a real date of birth." } });
    }
  });

  it("rejects malformed values and dates outside 1900 to today", () => {
    expect(withDate("15/07/1990")).toMatchObject({ ok: false, fieldErrors: { dateOfBirth: expect.any(String) } });
    expect(withDate("1899-12-31")).toMatchObject({ ok: false, fieldErrors: { dateOfBirth: expect.any(String) } });
    expect(withDate("2999-01-01")).toMatchObject({ ok: false, fieldErrors: { dateOfBirth: expect.any(String) } });
  });
});
