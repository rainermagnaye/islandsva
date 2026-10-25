import { beforeEach, describe, expect, it, vi } from "vitest";

// A Closer may now create the registration link. The guard is that the client is read under RLS first:
// a client the caller can't see (another Closer's) comes back null, and no link may be stored for it.

const dal = vi.hoisted(() => ({ getClient: vi.fn() }));
const onboarding = vi.hoisted(() => ({ issueClientOnboardingLink: vi.fn() }));
vi.mock("./dal", () => dal);
vi.mock("./onboarding-dal", () => onboarding);
vi.mock("./link", () => ({ onboardingUrl: (token: string, origin: string) => `${origin}/register/${token}`, registrationOrigin: async () => "https://app.test" }));
vi.mock("@/features/users/service", () => ({}));

const { openOnboardingLink } = await import("./service");

const client = { id: "c1", status: "pending", disabledAt: null, onboardingStatus: "ready" };

describe("openOnboardingLink", () => {
  beforeEach(() => {
    dal.getClient.mockReset();
    onboarding.issueClientOnboardingLink.mockReset().mockResolvedValue({ ok: true });
  });

  it("stores nothing for a client the caller can't read (RLS returns null)", async () => {
    dal.getClient.mockResolvedValue(null);
    expect(await openOnboardingLink("c1")).toEqual({ ok: false, reason: "not_found" });
    expect(onboarding.issueClientOnboardingLink).not.toHaveBeenCalled();
  });

  it("stores nothing for a disabled or already active client, or one that has a link", async () => {
    for (const over of [{ disabledAt: "2026-10-01" }, { status: "active" }, { onboardingStatus: "pending_customer" }]) {
      dal.getClient.mockResolvedValue({ ...client, ...over });
      expect((await openOnboardingLink("c1")).ok).toBe(false);
    }
    expect(onboarding.issueClientOnboardingLink).not.toHaveBeenCalled();
  });

  it("creates the link for a pending client the caller can read, and returns its URL", async () => {
    dal.getClient.mockResolvedValue(client);
    const result = await openOnboardingLink("c1");
    expect(result).toMatchObject({ ok: true, url: expect.stringMatching(/^https:\/\/app\.test\/register\/[A-Za-z0-9_-]{43}$/) });
    expect(onboarding.issueClientOnboardingLink).toHaveBeenCalledOnce();
  });
});
