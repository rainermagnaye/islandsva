import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, OUTAGE_MESSAGE } from "@/lib/validation";

// The action's own rules: the admin check runs before anything else, input is parsed, refusals become messages.
// The session, the database and Next's cache are replaced; the parser is the real one.

const requireRole = vi.fn();
const saveDiscoveryTimes = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("./dal", () => ({ saveDiscoveryTimes: (...args: unknown[]) => saveDiscoveryTimes(...args) }));

const { saveDiscoveryTimesAction } = await import("./actions");

const form = (...times: string[]) => {
  const data = new FormData();
  for (const time of times) data.append("times", time);
  return data;
};

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "admin" });
  saveDiscoveryTimes.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("saveDiscoveryTimesAction", () => {
  it("checks the admin role before reading or saving anything", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(saveDiscoveryTimesAction(form("09:00"))).rejects.toThrow("404");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(saveDiscoveryTimes).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("saves the times in order and refreshes the page", async () => {
    expect(await saveDiscoveryTimesAction(form("17:00", "09:00"))).toEqual({ ok: true });
    expect(saveDiscoveryTimes).toHaveBeenCalledWith(["09:00", "17:00"]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("saves an empty list (no calls offered)", async () => {
    expect(await saveDiscoveryTimesAction(form())).toEqual({ ok: true });
    expect(saveDiscoveryTimes).toHaveBeenCalledWith([]);
  });

  it("returns field errors without saving", async () => {
    const result = await saveDiscoveryTimesAction(form("09:15"));
    expect(result).toMatchObject({ ok: false, fieldErrors: { times: "Choose times on the hour or half hour." } });
    expect(saveDiscoveryTimes).not.toHaveBeenCalled();
  });

  it.each([
    ["not_allowed", "Your two-factor sign-in has expired. Sign in again, then save."],
    ["conflict", "Someone else just saved the times. Reload the page to see them, then save again."],
    ["invalid", FORM_ERROR],
  ])("explains a %s refusal and doesn't refresh", async (reason, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    saveDiscoveryTimes.mockResolvedValue({ ok: false, reason });
    expect(await saveDiscoveryTimesAction(form("09:00"))).toEqual({ ok: false, message });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers an outage with try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    saveDiscoveryTimes.mockRejectedValue(new UpstreamError("supabase", "down"));
    expect(await saveDiscoveryTimesAction(form("09:00"))).toEqual({ ok: false, message: OUTAGE_MESSAGE });
  });
});
