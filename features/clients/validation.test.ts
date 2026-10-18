import { describe, expect, it } from "vitest";
import { parseClientDetails, parseClientFlag, parseClientNote } from "./validation";

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
