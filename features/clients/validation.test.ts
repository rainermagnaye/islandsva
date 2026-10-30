import { describe, expect, it } from "vitest";
import { parseClientDetails, parseClientFlag, parseClientNote, parseCreateClient } from "./validation";
import { parseClientReview, parseNewClient, parsePaymentReceived } from "./review-validation";

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

describe("parseCreateClient", () => {
  it("trims the company and contact and keeps a blank phone empty", () => {
    expect(parseCreateClient({ companyName: " Cruz Co ", contactName: " Ana Cruz ", contactEmail: " Ana@Cruz.co ", contactPhone: "" })).toEqual({
      ok: true,
      value: { companyName: "Cruz Co", contactName: "Ana Cruz", contactEmail: "ana@cruz.co", contactPhone: null },
    });
  });

  it("requires a company, a name, and an email", () => {
    expect(parseCreateClient({ companyName: " ", contactName: "", contactEmail: "not-an-email", contactPhone: "" })).toMatchObject({
      ok: false,
      fieldErrors: { companyName: "Enter the company name.", contactName: "Enter the contact's name.", contactEmail: expect.any(String) },
    });
  });

  it("rejects a field that is not on the form", () => {
    expect(parseCreateClient({ companyName: "Cruz Co", contactName: "Ana", contactEmail: "ana@cruz.co", status: "active" }).ok).toBe(false);
  });
});

describe("parseClientReview", () => {
  it("requires a section and keeps an optional note", () => {
    expect(parseClientReview({ clientId, sections: [], note: "" })).toMatchObject({
      ok: false,
      fieldErrors: { sections: "Choose a section to send back." },
    });
    expect(parseClientReview({ clientId, sections: ["basic"], note: " City is wrong " })).toMatchObject({
      ok: true,
      value: { sections: ["basic"], note: "City is wrong" },
    });
    expect(parseClientReview({ clientId, sections: ["address"], note: "" })).toMatchObject({ ok: true, value: { note: "" } });
  });

  it("rejects a section that is not part of the review", () => {
    expect(parseClientReview({ clientId, sections: ["notes"], note: "" }).ok).toBe(false);
  });
});

describe("parsePaymentReceived", () => {
  const today = "2026-10-26";
  const base = { clientId, amount: "855.00", fee: "", paidOn: "2026-10-20", reference: " TRX-1 " };

  it("turns the amount and fee into cents and trims the reference", () => {
    expect(parsePaymentReceived(base, today)).toEqual({ ok: true, value: { clientId, amount: 85500, fee: 0, paidOn: "2026-10-20", reference: "TRX-1" } });
    expect(parsePaymentReceived({ ...base, fee: "15.5", reference: "" }, today)).toMatchObject({ ok: true, value: { fee: 1550, reference: null } });
    expect(parsePaymentReceived({ ...base, amount: "0.1" }, today)).toMatchObject({ ok: true, value: { amount: 10 } });
  });

  it("asks for a positive amount and a fee no bigger than it", () => {
    expect(parsePaymentReceived({ ...base, amount: "" }, today)).toMatchObject({ fieldErrors: { amount: expect.any(String) } });
    expect(parsePaymentReceived({ ...base, amount: "0" }, today)).toMatchObject({ fieldErrors: { amount: "Enter an amount above 0." } });
    expect(parsePaymentReceived({ ...base, amount: "12.345" }, today)).toMatchObject({ fieldErrors: { amount: expect.any(String) } });
    expect(parsePaymentReceived({ ...base, amount: "10", fee: "10.01" }, today)).toMatchObject({ fieldErrors: { fee: "The fee can't be more than the amount." } });
    expect(parsePaymentReceived({ ...base, fee: "-1" }, today)).toMatchObject({ fieldErrors: { fee: expect.any(String) } });
  });

  it("refuses a future date, a long reference and a tampered form", () => {
    expect(parsePaymentReceived({ ...base, paidOn: "2026-10-27" }, today)).toMatchObject({ fieldErrors: { paidOn: "The date can't be in the future." } });
    expect(parsePaymentReceived({ ...base, paidOn: "2026-10-26" }, today)).toMatchObject({ ok: true });
    expect(parsePaymentReceived({ ...base, reference: "x".repeat(201) }, today)).toMatchObject({ fieldErrors: { reference: expect.any(String) } });
    expect(parsePaymentReceived({ ...base, clientId: "nope" }, today)).toEqual({ ok: false, formError: expect.any(String) });
    expect(parsePaymentReceived({ ...base, actor: clientId }, today)).toEqual({ ok: false, formError: expect.any(String) });
  });
});
