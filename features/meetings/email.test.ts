import { beforeEach, describe, expect, it, vi } from "vitest";

// The confirmation email: fixed text plus the time, Reply-To the team, and a key per meeting and start.

const sendPlainEmail = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/email", () => ({ sendPlainEmail: (...args: unknown[]) => sendPlainEmail(...args) }));
vi.mock("@/lib/env", () => ({ env: { leadsNotifyEmail: () => "team@example.com" } }));

const { sendDiscoveryConfirmation } = await import("./email");

beforeEach(() => sendPlainEmail.mockClear());

describe("sendDiscoveryConfirmation", () => {
  it("sends fixed text with the visitor's time and Philippine time, Reply-To the team", async () => {
    await sendDiscoveryConfirmation({ meetingId: "m1", email: "visitor@example.com", startsAt: "2026-11-10T01:30:00.000Z", country: "United States" });
    const [, message, key] = sendPlainEmail.mock.calls[0] as [string, { to: string; replyTo: string; subject: string; text: string }, string];
    expect(message.to).toBe("visitor@example.com");
    expect(message.replyTo).toBe("team@example.com");
    expect(message.subject).toBe("Your discovery call with Islands VA is confirmed");
    expect(message.text).toContain("confirmed for Nov 9, 2026, 8:30");
    expect(message.text).toContain("New York");
    expect(message.text).toContain("PHT");
    expect(key).toBe("discovery-confirmation/m1/2026-11-10T01:30:00.000Z");
  });

  it("uses a new key for a new start, so a rescheduled call is emailed again", async () => {
    await sendDiscoveryConfirmation({ meetingId: "m1", email: "v@example.com", startsAt: "2026-11-10T01:30:00.000Z", country: null });
    await sendDiscoveryConfirmation({ meetingId: "m1", email: "v@example.com", startsAt: "2026-11-11T01:30:00.000Z", country: null });
    expect(sendPlainEmail.mock.calls[0][2]).not.toBe(sendPlainEmail.mock.calls[1][2]);
  });
});
