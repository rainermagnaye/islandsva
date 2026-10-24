import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPlainEmail } from "./email";

const message = { to: "ana@example.com", subject: "Hello", text: "Your link: https://example.com/secret" };

describe("sendPlainEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Islands VA <hello@example.com>");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends plain text to one address, with an optional reply-to", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendPlainEmail("Test email", { ...message, replyTo: "lead@example.com" })).toBe(true);
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body).toEqual({ from: "Islands VA <hello@example.com>", to: ["ana@example.com"], subject: "Hello", text: message.text, reply_to: "lead@example.com" });
    expect(body).not.toHaveProperty("html");
  });

  it("skips without calling Resend when email isn't configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendPlainEmail("Test email", message)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns false, never throws, and logs no address or link when Resend refuses or is unreachable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("bad", { status: 422 })));
    expect(await sendPlainEmail("Test email", message)).toBe(false);
    vi.stubGlobal("fetch", vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("fetch failed")));
    expect(await sendPlainEmail("Test email", message)).toBe(false);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("ana@example.com");
    expect(logged).not.toContain("secret");
  });
});
