import { describe, expect, it } from "vitest";
import { CONVERT_LIMITS, LEAD_LIMITS } from "./contract";
import { parseAdminLead, parseConvert, parseConvertNoted, parseLead, parseLeadEdit, parseLeadStatus, parseLeadStep } from "./validation";

const valid = {
  name: "  Ana Cruz ",
  email: " Ana@Example.COM ",
  company: " Cruz Co ",
  industry: " Real estate ",
  country: "Philippines",
  package: "executive",
  message: "Inbox help, please.",
  website: "",
  turnstileToken: "token",
};

describe("parseLead", () => {
  it("accepts a valid lead, trimming and normalising it", () => {
    const result = parseLead(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ana Cruz",
        email: "ana@example.com",
        company: "Cruz Co",
        industry: "Real estate",
        country: "Philippines",
        packageSlug: "executive",
        message: "Inbox help, please.",
      },
      isBot: false,
      turnstileToken: "token",
    });
  });

  it("requires company, industry and country", () => {
    expect(parseLead({ name: "Ana", email: "a@b.co", message: "Hi", company: " ", industry: "", country: "Atlantis" })).toMatchObject({
      ok: false,
      fieldErrors: { company: "Enter your company name.", industry: "Choose an industry.", country: "Choose a country." },
    });
  });

  it("accepts values exactly at each limit and rejects one over", () => {
    expect(parseLead({ ...valid, name: "a".repeat(LEAD_LIMITS.name) }).ok).toBe(true);
    expect(parseLead({ ...valid, name: "a".repeat(LEAD_LIMITS.name + 1) })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(parseLead({ ...valid, message: "a".repeat(LEAD_LIMITS.message + 1) })).toMatchObject({ ok: false, fieldErrors: { message: expect.any(String) } });
  });

  it("reports every invalid field at once", () => {
    const result = parseLead({ ...valid, name: " ", email: "nope", package: "gold" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), email: expect.any(String), package: expect.any(String) } });
  });

  it("rejects control characters, but allows line breaks in the message", () => {
    expect(parseLead({ ...valid, name: "A\u0007na" }).ok).toBe(false);
    expect(parseLead({ ...valid, message: "line one\nline two\ttab" }).ok).toBe(true);
  });

  it("rejects wrong types as field errors", () => {
    expect(parseLead({ ...valid, company: 5 })).toMatchObject({ ok: false, fieldErrors: { company: expect.any(String) } });
  });

  it.each([
    ["an unknown key", { ...valid, admin: true }],
    ["a non-object", [valid]],
    ["null", null],
    ["a non-string honeypot", { ...valid, website: 1 }],
    ["an oversized token", { ...valid, turnstileToken: "t".repeat(4097) }],
  ])("returns a form-level error for %s", (_, input) => {
    expect(parseLead(input)).toMatchObject({ ok: false, formError: expect.any(String) });
  });

  it("flags a filled honeypot as a bot without failing validation", () => {
    expect(parseLead({ ...valid, website: "spam.example" })).toMatchObject({ ok: true, isBot: true });
  });
});

describe("parseAdminLead", () => {
  it("stores the same lead as a discovery-call submission", () => {
    expect(parseAdminLead({ name: " Ana Cruz ", email: "Ana@Example.COM", company: "Cruz Co", industry: "Real estate", country: "Philippines", package: "", message: "Inbox help." })).toEqual({
      ok: true,
      value: { name: "Ana Cruz", email: "ana@example.com", company: "Cruz Co", industry: "Real estate", country: "Philippines", packageSlug: null, message: "Inbox help." },
    });
  });

  it("requires a name, email and company", () => {
    expect(parseAdminLead({ name: " ", email: "not-an-email", company: "", industry: "Legal", country: "Philippines", message: "Hi" })).toMatchObject({
      ok: false,
      fieldErrors: { name: "Enter their name.", email: expect.any(String), company: "Enter their company name." },
    });
  });
});

describe("parseConvert", () => {
  const convert = { leadId: "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60", companyName: " Cruz Co ", contactName: " Ana Cruz ", contactPhone: "" };

  it("trims the names and turns an empty phone into null", () => {
    expect(parseConvert(convert)).toEqual({
      ok: true,
      value: { leadId: convert.leadId, companyName: "Cruz Co", contactName: "Ana Cruz", contactPhone: null },
    });
  });

  it("requires the company and contact names", () => {
    expect(parseConvert({ ...convert, companyName: "  ", contactName: "" })).toEqual({
      ok: false,
      fieldErrors: { companyName: "Enter the client's company name.", contactName: "Enter the contact's name." },
    });
  });

  it("enforces the database limits", () => {
    const result = parseConvert({ ...convert, companyName: "a".repeat(CONVERT_LIMITS.companyName + 1), contactPhone: "1".repeat(CONVERT_LIMITS.contactPhone + 1) });
    expect(result).toMatchObject({ ok: false, fieldErrors: { companyName: expect.any(String), contactPhone: expect.any(String) } });
  });

  it.each([
    ["a malformed lead id", { ...convert, leadId: "42" }],
    ["an unknown field", { ...convert, status: "converted" }],
    ["a non-object", "lead"],
  ])("treats %s as a tampered form", (_, input) => {
    expect(parseConvert(input)).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseLeadStatus", () => {
  const leadId = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  it("accepts every hand-set status", () => {
    for (const status of ["new", "contacted", "qualified", "closed"]) {
      expect(parseLeadStatus({ leadId, status })).toEqual({ ok: true, value: { leadId, status } });
    }
  });

  it("rejects 'converted' (only converting a lead sets it), unknown statuses and bad ids as a tampered form", () => {
    expect(parseLeadStatus({ leadId, status: "converted" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseLeadStatus({ leadId, status: "won" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseLeadStatus({ leadId: "1", status: "closed" })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseLeadStatus({ leadId, status: "closed", extra: "x" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseLeadEdit", () => {
  const leadId = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  it("keeps a chosen dropdown and trims the extra text", () => {
    const core = {
      name: valid.name,
      email: valid.email,
      company: valid.company,
      industry: valid.industry,
      country: valid.country,
      package: valid.package,
      message: valid.message,
    };
    expect(parseLeadEdit({ ...core, leadId, jobTitle: " Founder ", source: "Referral", budget: "Nope" })).toMatchObject({
      ok: false,
      fieldErrors: { budget: "Choose an option from the list." },
    });
    expect(parseLeadEdit({ ...core, leadId, jobTitle: " Founder ", source: "Referral" })).toMatchObject({
      ok: true,
      value: { leadId, profile: { jobTitle: "Founder", source: "Referral", phone: "" } },
    });
  });
});

describe("parseLeadStep", () => {
  const leadId = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  it("trims a call summary", () => {
    expect(parseLeadStep({ leadId, kind: "call", body: "  Left a voicemail. " })).toEqual({
      ok: true,
      value: { leadId, kind: "call", body: "Left a voicemail." },
    });
  });

  it("rejects an empty remark and a kind the button cannot send", () => {
    expect(parseLeadStep({ leadId, kind: "note", body: "  " })).toMatchObject({ ok: false, fieldErrors: { body: expect.any(String) } });
    expect(parseLeadStep({ leadId, kind: "conversion", body: "Done" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseConvertNoted", () => {
  const leadId = "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60";
  const day = (offset: number) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
  };
  const noted = {
    leadId,
    companyName: "Cruz Co",
    contactName: "Ana Cruz",
    contactPhone: "",
    remarks: " Agreed on the call. ",
    package: "executive",
    hoursPerWeek: "40",
    termMonths: "6",
    startsOn: day(7),
    timezone: "America/New_York",
  };

  it("keeps the confirmed package and drops the price, which the server fills in", () => {
    expect(parseConvertNoted(noted)).toEqual({
      ok: true,
      value: {
        leadId,
        companyName: "Cruz Co",
        contactName: "Ana Cruz",
        contactPhone: null,
        remarks: "Agreed on the call.",
        packageSlug: "executive",
        hoursPerWeek: 40,
        termMonths: 6,
        startsOn: noted.startsOn,
        timezone: "America/New_York",
      },
    });
  });

  it("rejects hours that belong to a different package, a far start date and a missing package", () => {
    expect(parseConvertNoted({ ...noted, hoursPerWeek: "20" })).toMatchObject({
      ok: false,
      fieldErrors: { hoursPerWeek: "Choose the hours that come with this package." },
    });
    expect(parseConvertNoted({ ...noted, startsOn: day(400) })).toMatchObject({
      ok: false,
      fieldErrors: { startsOn: expect.any(String) },
    });
    expect(parseConvertNoted({ ...noted, package: "" })).toMatchObject({ ok: false, fieldErrors: { package: "Choose a package." } });
  });

  it("treats a submitted price as a tampered form", () => {
    expect(parseConvertNoted({ ...noted, monthlyCents: "1" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});
