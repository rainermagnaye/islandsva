import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ createUser: vi.fn(), generateLink: vi.fn(), deleteUser: vi.fn() }));
const roles = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: auth },
    from: () => ({ select: () => ({ eq: async () => ({ count: roles.count, error: null }) }) }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createLoginLink, discardNewLogin } = await import("./dal");

describe("createLoginLink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    roles.count = 0;
  });

  it("refuses any existing email (accepted or not) without touching that account", async () => {
    // An unaccepted staff invite: createUser says the email exists. generateLink would have reused that account.
    auth.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "exists" } });
    expect(await createLoginLink("pending-admin@x.co", "Ana")).toEqual({ ok: false, reason: "exists" });
    expect(auth.generateLink).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("creates a new login, then returns the invite token hash for that same login", async () => {
    auth.createUser.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
    auth.generateLink.mockResolvedValue({ data: { user: { id: "new-1" }, properties: { hashed_token: "hash-1" } }, error: null });
    expect(await createLoginLink("ana@x.co", "Ana")).toEqual({ ok: true, userId: "new-1", tokenHash: "hash-1" });
    expect(auth.createUser).toHaveBeenCalledWith({ email: "ana@x.co", email_confirm: false, user_metadata: { full_name: "Ana" } });
  });

  it("removes only the login it just created when the link can't be made for it", async () => {
    auth.createUser.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
    auth.generateLink.mockResolvedValue({ data: { user: { id: "someone-else" }, properties: { hashed_token: "h" } }, error: null });
    await expect(createLoginLink("ana@x.co", "Ana")).rejects.toThrow(/user mismatch/);
    expect(auth.deleteUser).toHaveBeenCalledTimes(1);
    expect(auth.deleteUser).toHaveBeenCalledWith("new-1");
  });
});

describe("discardNewLogin", () => {
  beforeEach(() => vi.resetAllMocks());

  it("never removes a login that holds a role", async () => {
    roles.count = 1;
    await discardNewLogin("staff-1");
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("removes a role-less new login", async () => {
    roles.count = 0;
    auth.deleteUser.mockResolvedValue({ error: null });
    await discardNewLogin("new-1");
    expect(auth.deleteUser).toHaveBeenCalledWith("new-1");
  });
});
