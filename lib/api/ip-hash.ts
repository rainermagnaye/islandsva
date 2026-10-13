import "server-only";
import { env } from "@/lib/env";

/** HMAC-SHA256 of the client IP — lets us spot abuse without storing raw IPs. Null when unconfigured. */
export async function hashIp(ip: string | null) {
  const secret = env.ipHashSecret();
  if (!ip || !secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ip));
  return Buffer.from(sig).toString("hex");
}
