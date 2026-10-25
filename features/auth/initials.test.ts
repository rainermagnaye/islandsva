import { describe, expect, it } from "vitest";
import { nameInitials } from "./initials";

describe("name initials", () => {
  it("uses the first and last name", () => {
    expect(nameInitials("Rainer Magnaye")).toBe("RM");
    expect(nameInitials("Mary Ann Santos")).toBe("MS");
    expect(nameInitials("Ada")).toBe("A");
    expect(nameInitials("  ")).toBe("");
  });
});
