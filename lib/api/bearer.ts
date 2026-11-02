import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether an Authorization header carries `Bearer <secret>`, compared in constant time (both sides hashed, so their
 * lengths can't leak either). False when the configured secret is missing or shorter than 32 characters, so an unset or
 * weak variable never opens the route.
 */
export function matchesBearer(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret));
}
