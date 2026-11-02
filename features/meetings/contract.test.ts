import { describe, expect, it } from "vitest";
import { confirmationLabel, confirmationState } from "./contract";

describe("the confirmation line", () => {
  it("is Not sent until the email went out", () => {
    expect(confirmationState({ confirmationSentAt: null, confirmationCurrent: false })).toBe("none");
    expect(confirmationLabel({ confirmationSentAt: null, confirmationCurrent: false })).toBe("Not sent");
  });

  it("shows when it was sent, in Philippine time", () => {
    const sent = { confirmationSentAt: "2026-11-02T02:04:00Z", confirmationCurrent: true };
    expect(confirmationState(sent)).toBe("sent");
    expect(confirmationLabel(sent)).toMatch(/^Sent Nov 2, 10:04\sAM PHT$/);
  });

  it("asks for the new time after a reschedule", () => {
    const earlier = { confirmationSentAt: "2026-11-02T02:04:00Z", confirmationCurrent: false };
    expect(confirmationState(earlier)).toBe("earlier");
    expect(confirmationLabel(earlier)).toBe("Sent for the earlier time");
  });
});
