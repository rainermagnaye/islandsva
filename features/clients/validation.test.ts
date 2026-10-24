import { describe, expect, it } from "vitest";
import { parseClientDetails, parseClientFlag, parseClientNote, parseNewClient, parseVaAssignment } from "./validation";

const clientId = "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60";

describe("parseClientDetails", () => {
  const details = {
    clientId,
    companyName: " Cruz Co ",
    contactName: " Ana Cruz ",
    contactPhone: "",
    industry: "Legal",
    country: "United States",
    website: "",
    jobTitle: " Founder ",
    street: "",
    city: " Austin ",
    state: "",
    zip: "",
    staffCount: "Just me",
    about: " Inbox help. ",
  };

  it("trims company details and keeps an empty phone empty", () => {
    expect(parseClientDetails(details)).toMatchObject({
      ok: true,
      value: {
        clientId,
        companyName: "Cruz Co",
        contactName: "Ana Cruz",
        contactPhone: null,
        business: { industry: "Legal", country: "United States", jobTitle: "Founder", city: "Austin", staffCount: "Just me", about: "Inbox help." },
      },
    });
  });

  it("rejects an unknown industry and a missing company", () => {
    expect(parseClientDetails({ ...details, industry: "Space", companyName: " " })).toMatchObject({
      ok: false,
      fieldErrors: { industry: "Choose an industry.", companyName: "Enter the company name." },
    });
  });

  it("treats a bad client id as a tampered form", () => {
    expect(parseClientDetails({ ...details, clientId: "42" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseClientNote", () => {
  it("trims the note", () => {
    expect(parseClientNote({ clientId, body: "  Called them.  " })).toEqual({ ok: true, value: { clientId, body: "Called them." } });
  });

  it("rejects an empty note", () => {
    expect(parseClientNote({ clientId, body: "  " })).toMatchObject({ ok: false, fieldErrors: { body: "Enter a note." } });
  });
});

describe("parseClientFlag", () => {
  it("reads disable and enable", () => {
    expect(parseClientFlag({ clientId, disabled: "true" })).toEqual({ ok: true, value: { clientId, disabled: true } });
    expect(parseClientFlag({ clientId, disabled: "false" })).toEqual({ ok: true, value: { clientId, disabled: false } });
  });

  it("rejects a tampered flag", () => {
    expect(parseClientFlag({ clientId, disabled: "yes" })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});

describe("parseNewClient", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const client = {
    companyName: " Cruz Co ",
    contactName: " Ana Cruz ",
    contactEmail: " Ana@Cruz.co ",
    contactPhone: "",
    package: "essentials",
    hoursPerWeek: "20",
    termMonths: "6",
    startsOn: "2026-11-01",
    timezone: "America/New_York",
  };

  it("trims and lower-cases what it should, and turns the package into numbers", () => {
    expect(parseNewClient(client, now)).toEqual({
      ok: true,
      value: {
        companyName: "Cruz Co",
        contactName: "Ana Cruz",
        contactEmail: "ana@cruz.co",
        contactPhone: null,
        packageSlug: "essentials",
        hoursPerWeek: 20,
        termMonths: 6,
        startsOn: "2026-11-01",
        timezone: "America/New_York",
      },
    });
  });

  it("never accepts a price from the form", () => {
    expect(parseNewClient({ ...client, monthlyCents: "1" }, now)).toMatchObject({ ok: false, formError: expect.any(String) });
  });

  it("needs a company, a contact and a real email", () => {
    expect(parseNewClient({ ...client, companyName: " ", contactName: "", contactEmail: "ana@" }, now)).toMatchObject({
      ok: false,
      fieldErrors: { companyName: expect.any(String), contactName: expect.any(String), contactEmail: expect.any(String) },
    });
  });

  it("refuses an unknown package, time zone or term", () => {
    expect(parseNewClient({ ...client, package: "gold", timezone: "Mars/Base", termMonths: "3" }, now)).toMatchObject({
      ok: false,
      fieldErrors: { package: expect.any(String), timezone: expect.any(String), termMonths: expect.any(String) },
    });
  });

  it("refuses hours that don't belong to the package", () => {
    expect(parseNewClient({ ...client, hoursPerWeek: "80" }, now)).toEqual({ ok: false, fieldErrors: { hoursPerWeek: "Choose the hours that come with this package." } });
  });

  it("takes a start date from today through the next year, and only real dates", () => {
    expect(parseNewClient({ ...client, startsOn: "2026-10-24" }, now).ok).toBe(true);
    expect(parseNewClient({ ...client, startsOn: "2026-10-20" }, now)).toMatchObject({ ok: false, fieldErrors: { startsOn: expect.any(String) } });
    expect(parseNewClient({ ...client, startsOn: "2027-12-01" }, now)).toMatchObject({ ok: false, fieldErrors: { startsOn: expect.any(String) } });
    expect(parseNewClient({ ...client, startsOn: "2026-02-30" }, now)).toMatchObject({ ok: false, fieldErrors: { startsOn: expect.any(String) } });
  });

  it("keeps names free of control characters and within their limits", () => {
    expect(parseNewClient({ ...client, companyName: "A\u0000B", contactName: "x".repeat(121) }, now)).toMatchObject({
      ok: false,
      fieldErrors: { companyName: expect.any(String), contactName: expect.any(String) },
    });
  });
});

describe("parseVaAssignment", () => {
  const vaId = "1c8d7b63-6b5f-4f1c-8b9f-3c2d4e5f6a71";
  it("takes a client and a VA", () => {
    expect(parseVaAssignment({ clientId, vaId })).toEqual({ ok: true, value: { clientId, vaId } });
  });
  it("asks for a VA when none is chosen, and treats a bad client id or extra key as tampering", () => {
    expect(parseVaAssignment({ clientId, vaId: "" })).toMatchObject({ ok: false, fieldErrors: { vaId: "Choose a VA." } });
    expect(parseVaAssignment({ clientId: "x", vaId })).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(parseVaAssignment({ clientId, vaId, assignedBy: vaId })).toMatchObject({ ok: false, formError: expect.any(String) });
  });
});
