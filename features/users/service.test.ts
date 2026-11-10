import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";

const dal = {
  createAuthUser: vi.fn(),
  deleteAuthUser: vi.fn(),
  emailHasAccount: vi.fn(),
  getInvitedAt: vi.fn(),
  getUser: vi.fn(),
  grantRole: vi.fn(),
  inviteAuthUser: vi.fn(),
  setAuthUserLocked: vi.fn(),
};

vi.mock("./dal", () => ({
  ...Object.fromEntries(Object.entries(dal).map(([name, fn]) => [name, (...args: unknown[]) => fn(...args)])),
  listUsers: vi.fn(),
  searchProfiles: vi.fn(),
  setAccountInactive: vi.fn(),
  employeeHasHistory: vi.fn(),
}));
vi.mock("./employee-dal", () => ({ getEmployeeProfile: vi.fn(), setEmployeeReview: vi.fn(), employeeHasAvatar: vi.fn() }));

const { createEmployee, inviteEmployee, sendEmployeeInvitation } = await import("./service");

const ORIGIN = "https://app.example.test";
const newVa = { id: "u1", email: "ada@example.test", fullName: "Ada", roles: ["va"], status: "invited", signedInAt: null };
const input = { email: "ada@example.test", fullName: "Ada", role: "va" as const };

beforeEach(() => {
  for (const fn of Object.values(dal)) fn.mockReset();
  dal.emailHasAccount.mockResolvedValue(false);
  dal.getUser.mockResolvedValue(newVa);
  dal.getInvitedAt.mockResolvedValue(null);
  dal.inviteAuthUser.mockResolvedValue({ ok: true, userId: "u1" });
  dal.createAuthUser.mockResolvedValue({ ok: true, userId: "u1" });
});

describe("createEmployee", () => {
  it("creates the account (locked, no email) and grants the role", async () => {
    await expect(createEmployee(input, "admin")).resolves.toEqual({ ok: true, userId: "u1" });
    expect(dal.createAuthUser).toHaveBeenCalledWith("ada@example.test", "Ada", "staff");
    expect(dal.grantRole).toHaveBeenCalledWith("u1", "va", "admin");
    expect(dal.inviteAuthUser).not.toHaveBeenCalled();
  });
});

describe("inviteEmployee", () => {
  it("refuses an email that already has an account, without inviting or deleting it", async () => {
    dal.emailHasAccount.mockResolvedValue(true);
    await expect(inviteEmployee(input, "admin", ORIGIN)).resolves.toEqual({ ok: false, reason: "exists" });
    expect(dal.inviteAuthUser).not.toHaveBeenCalled();
    expect(dal.grantRole).not.toHaveBeenCalled();
    expect(dal.deleteAuthUser).not.toHaveBeenCalled();
  });
});

describe("sendEmployeeInvitation", () => {
  it("unlocks the account, then sends the invite", async () => {
    await expect(sendEmployeeInvitation("u1", ORIGIN)).resolves.toEqual({ ok: true });
    expect(dal.setAuthUserLocked).toHaveBeenCalledExactlyOnceWith("u1", false);
    expect(dal.setAuthUserLocked.mock.invocationCallOrder[0]).toBeLessThan(dal.inviteAuthUser.mock.invocationCallOrder[0]);
  });

  it("locks the account again when a first invite fails", async () => {
    dal.inviteAuthUser.mockResolvedValue({ ok: false, reason: "rate" });
    await expect(sendEmployeeInvitation("u1", ORIGIN)).resolves.toEqual({ ok: false, reason: "rate" });
    expect(dal.setAuthUserLocked).toHaveBeenLastCalledWith("u1", true);
  });

  it("locks the account again when the send throws", async () => {
    dal.inviteAuthUser.mockRejectedValue(new UpstreamError("supabase-auth", "down"));
    await expect(sendEmployeeInvitation("u1", ORIGIN)).rejects.toThrow(UpstreamError);
    expect(dal.setAuthUserLocked).toHaveBeenLastCalledWith("u1", true);
  });

  it("never locks an account that has had an invite, even when this send fails", async () => {
    dal.getInvitedAt.mockResolvedValue("2026-11-10T00:00:00Z");
    dal.inviteAuthUser.mockResolvedValue({ ok: false, reason: "rate" });
    await sendEmployeeInvitation("u1", ORIGIN);
    expect(dal.setAuthUserLocked).not.toHaveBeenCalledWith("u1", true);
  });

  it("touches no account that isn't eligible", async () => {
    dal.getUser.mockResolvedValue({ ...newVa, roles: ["client"] });
    await expect(sendEmployeeInvitation("u1", ORIGIN)).resolves.toEqual({ ok: false, reason: "missing" });
    dal.getUser.mockResolvedValue({ ...newVa, status: "inactive" });
    await expect(sendEmployeeInvitation("u1", ORIGIN)).resolves.toEqual({ ok: false, reason: "exists" });
    expect(dal.setAuthUserLocked).not.toHaveBeenCalled();
    expect(dal.inviteAuthUser).not.toHaveBeenCalled();
  });
});
