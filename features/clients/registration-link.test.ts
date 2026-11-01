import { beforeEach, describe, expect, it, vi } from "vitest";

// A Closer may create the registration link only for a client they created. Reads can now see the
// rest of the agency, so the guard is canSeeRegistrationLink (createdById), not RLS.

const dal = vi.hoisted(() => ({ getClient: vi.fn() }));
const onboarding = vi.hoisted(() => ({ issueClientOnboardingLink: vi.fn() }));
const session = vi.hoisted(() => ({
  getSessionUser: vi.fn(async (): Promise<{ id: string; roles: string[]; aal: string } | null> => null),
  requireRole: vi.fn(),
}));
vi.mock("./dal", () => dal);
vi.mock("./onboarding-dal", () => onboarding);
vi.mock("./link", () => ({ onboardingUrl: (token: string, origin: string) => `${origin}/register/${token}`, registrationOrigin: async () => "https://app.test" }));
vi.mock("@/features/users/service", () => ({}));
vi.mock("@/lib/auth/session", () => session);

const { openOnboardingLink } = await import("./service");

const client = { id: "c1", status: "pending", disabledAt: null, onboardingStatus: "ready", createdById: "closer-1" };

describe("openOnboardingLink", () => {
  beforeEach(() => {
    dal.getClient.mockReset();
    onboarding.issueClientOnboardingLink.mockReset().mockResolvedValue({ ok: true });
    session.getSessionUser.mockReset().mockResolvedValue(null);
  });

  it("stores nothing for a client the caller can't read", async () => {
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

  it("a Lead Gen cannot store a link for a client they did not create", async () => {
    session.getSessionUser.mockResolvedValue({ id: "closer-1", roles: ["closer"], aal: "aal1" });
    dal.getClient.mockResolvedValue({ ...client, createdById: "closer-2" });
    expect(await openOnboardingLink("c1")).toEqual({ ok: false, reason: "not_found" });
    expect(onboarding.issueClientOnboardingLink).not.toHaveBeenCalled();
  });

  it("stores nothing without a session", async () => {
    dal.getClient.mockResolvedValue(client);
    expect(await openOnboardingLink("c1")).toEqual({ ok: false, reason: "not_found" });
    expect(onboarding.issueClientOnboardingLink).not.toHaveBeenCalled();
  });

  it("an admin can store a link for a client another Lead Gen created", async () => {
    session.getSessionUser.mockResolvedValue({ id: "admin-1", roles: ["admin"], aal: "aal2" });
    dal.getClient.mockResolvedValue(client);
    expect((await openOnboardingLink("c1")).ok).toBe(true);
  });

  it("creates the link for a pending client the caller can write, and returns its URL", async () => {
    session.getSessionUser.mockResolvedValue({ id: "closer-1", roles: ["closer"], aal: "aal1" });
    dal.getClient.mockResolvedValue(client);
    const result = await openOnboardingLink("c1");
    expect(result).toMatchObject({ ok: true, url: expect.stringMatching(/^https:\/\/app\.test\/register\/[A-Za-z0-9_-]{43}$/) });
    expect(onboarding.issueClientOnboardingLink).toHaveBeenCalledOnce();
    // The database checks the actor again, so the signed-in user is passed through.
    expect(onboarding.issueClientOnboardingLink.mock.calls[0][3]).toBe("closer-1");
  });
});
