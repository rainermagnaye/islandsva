import { beforeEach, describe, expect, it, vi } from "vitest";

// sendAcknowledgement and sendExpiryNotices: only the live site sends (the other deployments share its database), they
// send what the claim returned, and they never throw (they run in after()).

const live = vi.fn(() => true);
const dal = vi.hoisted(() => ({ claimAcknowledgement: vi.fn(), claimExpiryNotices: vi.fn() }));
const email = vi.hoisted(() => ({ sendDiscoveryAcknowledgement: vi.fn(), sendDiscoveryExpired: vi.fn(), sendDiscoveryConfirmation: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { isLiveDeployment: () => live() } }));
vi.mock("./visitor-email-dal", () => dal);
vi.mock("./email", () => email);
vi.mock("./confirmation-dal", () => ({}));
vi.mock("./dal", () => ({}));
vi.mock("./client-dal", () => ({}));
vi.mock("./va-dal", () => ({}));
vi.mock("./booking-dal", () => ({}));

const { sendAcknowledgement, sendExpiryNotices } = await import("./service");

const call = { meetingId: "m1", email: "visitor@example.com", startsAt: "2026-11-10T01:30:00+00:00", country: "United States" };

beforeEach(() => {
  live.mockReset().mockReturnValue(true);
  dal.claimAcknowledgement.mockReset().mockResolvedValue(call);
  dal.claimExpiryNotices.mockReset().mockResolvedValue([call, { ...call, meetingId: "m2" }]);
  email.sendDiscoveryAcknowledgement.mockReset().mockResolvedValue(true);
  email.sendDiscoveryExpired.mockReset().mockResolvedValue(true);
});

describe("sendAcknowledgement", () => {
  it("claims nothing and sends nothing off the live site", async () => {
    live.mockReturnValue(false);
    await sendAcknowledgement("lead-1");
    expect(dal.claimAcknowledgement).not.toHaveBeenCalled();
    expect(email.sendDiscoveryAcknowledgement).not.toHaveBeenCalled();
  });

  it("sends the claimed request, and nothing when there is no claim", async () => {
    await sendAcknowledgement("lead-1");
    expect(dal.claimAcknowledgement).toHaveBeenCalledWith("lead-1");
    expect(email.sendDiscoveryAcknowledgement).toHaveBeenCalledWith(call);
    dal.claimAcknowledgement.mockResolvedValue(null);
    await sendAcknowledgement("lead-1");
    expect(email.sendDiscoveryAcknowledgement).toHaveBeenCalledTimes(1);
  });

  it("logs a failed claim instead of throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dal.claimAcknowledgement.mockRejectedValue(new Error("down"));
    await expect(sendAcknowledgement("lead-1")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("sendExpiryNotices", () => {
  it("claims nothing off the live site", async () => {
    live.mockReturnValue(false);
    await sendExpiryNotices();
    expect(dal.claimExpiryNotices).not.toHaveBeenCalled();
  });

  it("sends every claimed notice", async () => {
    await sendExpiryNotices();
    expect(email.sendDiscoveryExpired.mock.calls.map(([c]) => c.meetingId)).toEqual(["m1", "m2"]);
  });

  it("logs a failed claim instead of throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dal.claimExpiryNotices.mockRejectedValue(new Error("down"));
    await expect(sendExpiryNotices()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
