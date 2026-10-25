import { describe, expect, it } from "vitest";
import { refusalOf } from "./booking-dal";

describe("refusalOf", () => {
  it("maps each database refusal to a reason the actions explain", () => {
    expect(refusalOf("IVA16", "")).toBe("has_va");
    expect(refusalOf("IVA17", "")).toBe("open_demo");
    expect(refusalOf("IVA18", "")).toBe("slot_taken");
    expect(refusalOf("IVA19", "")).toBe("out_of_range");
    expect(refusalOf("IVA20", "")).toBe("too_late");
    expect(refusalOf("IVA14", "")).toBe("not_allowed");
  });

  it("reads a unique-index race (two requests at once) like the check it backs", () => {
    expect(refusalOf("23505", 'duplicate key value violates unique constraint "demo_bookings_one_open_per_client"')).toBe("open_demo");
    expect(refusalOf("23505", 'duplicate key value violates unique constraint "demo_bookings_slot_once"')).toBe("slot_taken");
  });

  it("leaves anything else to the caller as an outage", () => {
    expect(refusalOf("57014", "canceling statement due to statement timeout")).toBeNull();
    expect(refusalOf(undefined, undefined)).toBeNull();
  });
});
