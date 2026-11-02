import { beforeEach, describe, expect, it, vi } from "vitest";

// The job's endpoint: 404 without the exact bearer secret (and when none is configured), otherwise it sends after the
// response.

const secret = vi.fn<() => string | undefined>(() => "job-secret-0123456789abcdef0123456789");
const sendExpiryNotices = vi.fn(async () => {});
const after = vi.fn();
vi.mock("next/server", () => ({ after: (fn: unknown) => after(fn) }));
vi.mock("@/lib/env", () => ({ env: { discoveryExpirySecret: () => secret() } }));
vi.mock("@/features/meetings/service", () => ({ sendExpiryNotices }));

const { POST } = await import("./route");
const call = (authorization?: string) =>
  POST(new Request("https://islandsva.com/api/v1/internal/discovery-expiry", { method: "POST", headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  secret.mockReset().mockReturnValue("job-secret-0123456789abcdef0123456789");
  after.mockClear();
});

describe("POST /api/v1/internal/discovery-expiry", () => {
  it("sends the notices after the response for the job's secret", async () => {
    const res = await call("Bearer job-secret-0123456789abcdef0123456789");
    expect(res.status).toBe(202);
    expect(after).toHaveBeenCalledWith(sendExpiryNotices);
  });

  it("is a 404 without the exact secret, and does nothing", async () => {
    for (const header of [undefined, "Bearer wrong", "job-secret-0123456789abcdef0123456789"]) {
      expect((await call(header)).status, String(header)).toBe(404);
    }
    expect(after).not.toHaveBeenCalled();
  });

  it("is a 404 for everyone when no secret is configured", async () => {
    secret.mockReturnValue(undefined);
    expect((await call("Bearer ")).status).toBe(404);
    expect((await call("Bearer undefined")).status).toBe(404);
    expect(after).not.toHaveBeenCalled();
  });
});
