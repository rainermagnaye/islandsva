import { describe, expect, it } from "vitest";
import { discoveryRefusal } from "./dal";

describe("discoveryRefusal", () => {
  it("explains each refusal of the contact form's time to the visitor", () => {
    expect(discoveryRefusal("IVA22")).toMatch(/no longer open/);
    expect(discoveryRefusal("23514")).toBe(discoveryRefusal("IVA22"));
    expect(discoveryRefusal("IVA24")).toMatch(/If you've already requested a call/);
    expect(discoveryRefusal("23505")).toMatch(/just taken/);
  });

  it("leaves anything else to the caller as an outage", () => {
    expect(discoveryRefusal("57014")).toBeNull();
    expect(discoveryRefusal("PGRST301")).toBeNull();
    expect(discoveryRefusal(undefined)).toBeNull();
  });
});
