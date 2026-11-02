import { beforeEach, describe, expect, it, vi } from "vitest";

// sendConfirmation: only the live site sends (the other deployments share its database), at most once per start,
// and a failed send releases exactly its own claim.

const live = vi.fn(() => true);
const confirmation = vi.hoisted(() => ({ claimConfirmation: vi.fn(), releaseConfirmation: vi.fn() }));
const email = vi.hoisted(() => ({ sendDiscoveryConfirmation: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { isLiveDeployment: () => live() } }));
vi.mock("./confirmation-dal", () => confirmation);
vi.mock("./email", () => email);
vi.mock("./dal", () => ({}));
vi.mock("./client-dal", () => ({}));
vi.mock("./va-dal", () => ({}));
vi.mock("./booking-dal", () => ({}));

const { sendConfirmation } = await import("./service");

const call = { email: "visitor@example.com", startsAt: "2026-11-10T01:30:00+00:00", country: "United States", claimedAt: "2026-11-02T03:04:05.123456+00:00" };

beforeEach(() => {
  live.mockReset().mockReturnValue(true);
  confirmation.claimConfirmation.mockReset().mockResolvedValue({ ok: true, call });
  confirmation.releaseConfirmation.mockReset().mockResolvedValue(undefined);
  email.sendDiscoveryConfirmation.mockReset().mockResolvedValue(true);
});

describe("sendConfirmation", () => {
  it("claims nothing and sends nothing off the live site", async () => {
    live.mockReturnValue(false);
    expect(await sendConfirmation("m1", "closer-1")).toBe("skipped");
    expect(confirmation.claimConfirmation).not.toHaveBeenCalled();
    expect(email.sendDiscoveryConfirmation).not.toHaveBeenCalled();
  });

  it("claims as the actor, then sends the claimed call", async () => {
    expect(await sendConfirmation("m1", "closer-1")).toBe("sent");
    expect(confirmation.claimConfirmation).toHaveBeenCalledWith("m1", "closer-1");
    expect(email.sendDiscoveryConfirmation).toHaveBeenCalledWith({ meetingId: "m1", email: call.email, startsAt: call.startsAt, country: call.country });
    expect(confirmation.releaseConfirmation).not.toHaveBeenCalled();
  });

  it("sends nothing when the database refuses or it was already sent for this time", async () => {
    confirmation.claimConfirmation.mockResolvedValue({ ok: false, reason: "refused" });
    expect(await sendConfirmation("m1", "closer-2")).toBe("refused");
    confirmation.claimConfirmation.mockResolvedValue({ ok: false, reason: "bad_address" });
    expect(await sendConfirmation("m1", "closer-1")).toBe("bad_address");
    confirmation.claimConfirmation.mockResolvedValue({ ok: true, call: null });
    expect(await sendConfirmation("m1", "closer-1")).toBe("already_sent");
    expect(email.sendDiscoveryConfirmation).not.toHaveBeenCalled();
  });

  it("releases its own claim when the send fails", async () => {
    email.sendDiscoveryConfirmation.mockResolvedValue(false);
    expect(await sendConfirmation("m1", "closer-1")).toBe("failed");
    expect(confirmation.releaseConfirmation).toHaveBeenCalledWith("m1", call.claimedAt);
  });
});
