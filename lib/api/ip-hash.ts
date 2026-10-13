import "server-only";
import { env } from "@/lib/env";

const encoder = new TextEncoder();

// The imported HMAC key, reused across requests (importKey is the costly step). Keyed by the secret, so
// a changed IP_HASH_SECRET takes effect without a restart.
let cached: { secret: string; key: Promise<CryptoKey> } | undefined;

function hmacKey(secret: string) {
  if (cached?.secret !== secret) {
    const key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    // A failed import isn't kept: the next request tries again.
    key.catch(() => {
      if (cached?.key === key) cached = undefined;
    });
    cached = { secret, key };
  }
  return cached.key;
}

/** HMAC-SHA256 of the client IP — lets us spot abuse without storing raw IPs. Null when unconfigured. */
export async function hashIp(ip: string | null) {
  const secret = env.ipHashSecret();
  if (!ip || !secret) return null;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(ip));
  return Buffer.from(sig).toString("hex");
}
