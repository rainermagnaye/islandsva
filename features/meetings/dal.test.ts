import { describe, expect, it } from "vitest";
import { refusalOf } from "./dal";

describe("refusalOf", () => {
  it("maps each database refusal to a reason the action explains", () => {
    expect(refusalOf("42501")).toBe("not_allowed");
    expect(refusalOf("23505")).toBe("conflict");
    expect(refusalOf("23514")).toBe("invalid");
    expect(refusalOf("22007")).toBe("invalid");
  });

  it("leaves anything else to the caller as an outage", () => {
    expect(refusalOf("57014")).toBeNull();
    expect(refusalOf("PGRST301")).toBeNull();
    expect(refusalOf(undefined)).toBeNull();
  });
});
