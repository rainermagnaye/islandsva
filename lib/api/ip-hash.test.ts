import { afterEach, describe, expect, it, vi } from "vitest";
import { hashIp } from "./ip-hash";

afterEach(() => vi.unstubAllEnvs());

describe("hashIp", () => {
  it("is a stable keyed hash, never the raw IP", async () => {
    vi.stubEnv("IP_HASH_SECRET", "test-secret-one");
    const first = await hashIp("203.0.113.7");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp("203.0.113.7")).toBe(first);
    expect(await hashIp("203.0.113.8")).not.toBe(first);
  });

  it("changes with the secret (the cached key follows it)", async () => {
    vi.stubEnv("IP_HASH_SECRET", "test-secret-one");
    const one = await hashIp("203.0.113.7");
    vi.stubEnv("IP_HASH_SECRET", "test-secret-two");
    expect(await hashIp("203.0.113.7")).not.toBe(one);
  });

  it("returns null without an IP or a secret", async () => {
    vi.stubEnv("IP_HASH_SECRET", "test-secret-one");
    expect(await hashIp(null)).toBeNull();
    vi.stubEnv("IP_HASH_SECRET", "");
    expect(await hashIp("203.0.113.7")).toBeNull();
  });
});
