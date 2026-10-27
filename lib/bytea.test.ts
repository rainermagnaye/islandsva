import { describe, expect, it } from "vitest";
import { decodeBytea } from "./bytea";

describe("decodeBytea", () => {
  it("reads PostgREST's \\x-prefixed hex", () => {
    expect([...decodeBytea("\\x48690a")]).toEqual([0x48, 0x69, 0x0a]);
  });

  it("reads bare hex", () => {
    expect([...decodeBytea("4869")]).toEqual([0x48, 0x69]);
  });

  it("reads base64 when the value isn't even-length hex", () => {
    expect(Buffer.from(decodeBytea("SGk=")).toString()).toBe("Hi");
    expect(Buffer.from(decodeBytea("SGVsbG8")).toString()).toBe("Hello");
  });

  it("returns no bytes for an empty value", () => {
    expect(decodeBytea("")).toHaveLength(0);
    expect(decodeBytea("\\x")).toHaveLength(0);
  });
});
