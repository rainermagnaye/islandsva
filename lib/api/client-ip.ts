import "server-only";

/**
 * The client IP as the platform proxy reports it (Vercel sets x-forwarded-for; its first entry is the client).
 * Evidence only — hashed into the lead or the agreement acceptance. Never use it for authorization or rate limits:
 * outside Vercel's proxy the header is whatever the caller sent.
 */
export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}
