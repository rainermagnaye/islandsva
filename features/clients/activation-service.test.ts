import { beforeEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({ createClientLogin: vi.fn(), discardClientLogin: vi.fn(async () => {}), clientSignInLink: vi.fn() }));
const dal = vi.hoisted(() => ({
  activateClientRecord: vi.fn(),
  getClientLogin: vi.fn(),
  paymentBelongsTo: vi.fn(),
  recordManualPayment: vi.fn(),
  voidPayment: vi.fn(),
}));
const email = vi.hoisted(() => ({ sendAccountEmail: vi.fn(async () => true), sendOnboardingEmail: vi.fn(), sendOnboardingSubmittedEmail: vi.fn() }));
vi.mock("@/features/users/service", () => users);
vi.mock("./activation-dal", () => dal);
vi.mock("./email", () => email);
vi.mock("./onboarding-dal", () => ({}));
vi.mock("./dal", () => ({}));

const { activateClientAccount, resendClientAccountEmail, voidClientPayment } = await import("./service");

const client = { id: "c1", contactEmail: "ana@cruz.co", contactName: "Ana", companyName: "Cruz Co" };

describe("activateClientAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an email that already has an account, and deletes nothing", async () => {
    users.createClientLogin.mockResolvedValue({ ok: false, reason: "exists" });
    expect(await activateClientAccount(client, "closer-1")).toEqual({ ok: false, reason: "login_taken" });
    expect(dal.activateClientRecord).not.toHaveBeenCalled();
    expect(users.discardClientLogin).not.toHaveBeenCalled();
  });

  it("removes the new login when the database refuses activation", async () => {
    users.createClientLogin.mockResolvedValue({ ok: true, userId: "new-1", tokenHash: "h" });
    dal.activateClientRecord.mockResolvedValue({ ok: false, reason: "unpaid" });
    expect(await activateClientAccount(client, "closer-1")).toEqual({ ok: false, reason: "unpaid" });
    expect(users.discardClientLogin).toHaveBeenCalledWith("new-1");
    expect(email.sendAccountEmail).not.toHaveBeenCalled();
  });

  it("removes the new login and fails when the database is down", async () => {
    users.createClientLogin.mockResolvedValue({ ok: true, userId: "new-1", tokenHash: "h" });
    dal.activateClientRecord.mockRejectedValue(new Error("down"));
    await expect(activateClientAccount(client, "closer-1")).rejects.toThrow("down");
    expect(users.discardClientLogin).toHaveBeenCalledWith("new-1");
  });

  it("emails the client a single-use invite link on success", async () => {
    users.createClientLogin.mockResolvedValue({ ok: true, userId: "new-1", tokenHash: "hash/+1" });
    dal.activateClientRecord.mockResolvedValue({ ok: true });
    expect(await activateClientAccount(client, "closer-1")).toEqual({ ok: true, emailed: true });
    const sent = email.sendAccountEmail.mock.calls[0][0] as { to: string; link: string };
    expect(sent.to).toBe("ana@cruz.co");
    expect(sent.link).toMatch(/\/auth\/confirm\?token_hash=hash%2F%2B1&type=invite$/);
    expect(users.discardClientLogin).not.toHaveBeenCalled();
  });
});

describe("resendClientAccountEmail", () => {
  it("sends to the login's own email, not the client's contact email", async () => {
    dal.getClientLogin.mockResolvedValue({ userId: "u1", name: "Ana" });
    users.clientSignInLink.mockResolvedValue({ ok: true, email: "login@cruz.co", tokenHash: "h" });
    await resendClientAccountEmail({ id: "c1", companyName: "Cruz Co" });
    expect(users.clientSignInLink).toHaveBeenCalledWith("u1");
    expect((email.sendAccountEmail.mock.calls.at(-1)?.[0] as { to: string }).to).toBe("login@cruz.co");
  });
});

describe("voidClientPayment", () => {
  it("won't void a payment that isn't the authorized client's", async () => {
    dal.paymentBelongsTo.mockResolvedValue(false);
    expect(await voidClientPayment("c1", "p-other", "admin-1")).toEqual({ ok: false, reason: "not_found" });
    expect(dal.voidPayment).not.toHaveBeenCalled();
  });
});
