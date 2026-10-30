import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry, trimmed", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers({ "x-forwarded-for": " , ", "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "" }))).toBeNull();
  });
});
