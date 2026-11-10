import { beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
const updateUserById = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: (...args: unknown[]) => createUser(...args), updateUserById: (...args: unknown[]) => updateUserById(...args) } } }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAuthUser, setAuthUserLocked } = await import("./dal");

beforeEach(() => {
  createUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  updateUserById.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe("account lock for Create", () => {
  it("creates the account locked, unconfirmed and without an email", async () => {
    await expect(createAuthUser("ada@example.test", "Ada", "staff")).resolves.toEqual({ ok: true, userId: "u1" });
    const attributes = createUser.mock.calls[0][0];
    expect(attributes).toMatchObject({ email: "ada@example.test", email_confirm: false, ban_duration: "876000h" });
    expect(attributes).not.toHaveProperty("password");
  });

  it("locks and unlocks through the ban", async () => {
    await setAuthUserLocked("u1", true);
    await setAuthUserLocked("u1", false);
    expect(updateUserById.mock.calls).toEqual([
      ["u1", { ban_duration: "876000h" }],
      ["u1", { ban_duration: "none" }],
    ]);
  });
});
