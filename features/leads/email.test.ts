import { beforeEach, describe, expect, it, vi } from "vitest";

// The team's new-lead email: a discovery request carries no contact details (the inbox hides them until a Lead Gen
// confirms); a plain enquiry carries them, Reply-To the visitor.

const sendPlainEmail = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/email", () => ({ sendPlainEmail: (...args: unknown[]) => sendPlainEmail(...args) }));
vi.mock("@/lib/env", () => ({ env: { leadsNotifyEmail: () => "team@example.com" } }));

const { sendLeadNotification } = await import("./email");

type Sent = [string, { to: string; replyTo?: string; subject: string; text: string }];
const lead = {
  name: "Mia Reyes",
  email: "mia@reyes.co",
  company: "Reyes Co",
  industry: "Legal",
  country: "United States",
  message: "Need help with my inbox",
  packageSlug: null,
};

beforeEach(() => sendPlainEmail.mockClear());

describe("sendLeadNotification", () => {
  it("names only the time of a discovery request, with no contact details or Reply-To", async () => {
    await sendLeadNotification(lead, "2026-11-10T01:30:00.000Z");
    const [, message] = sendPlainEmail.mock.calls[0] as Sent;
    expect(message.to).toBe("team@example.com");
    expect(message.replyTo).toBeUndefined();
    expect(message.subject).toContain("New discovery request for Nov 9, 2026, 8:30");
    expect(message.text).toContain("/leadgen");
    for (const detail of [lead.name, lead.email, lead.company, lead.message]) {
      expect(message.subject + message.text).not.toContain(detail);
    }
  });

  it("carries a plain enquiry's details, Reply-To the visitor", async () => {
    await sendLeadNotification(lead);
    const [, message] = sendPlainEmail.mock.calls[0] as Sent;
    expect(message.replyTo).toBe(lead.email);
    expect(message.text).toContain(lead.company);
    expect(message.text).toContain(lead.message);
  });
});
