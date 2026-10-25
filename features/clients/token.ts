import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 32 bytes, base64url, with no padding: 43 characters. Mirrored by client_packets.token. */
const TOKEN_BYTES = 32;

export function createOnboardingToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 hex. The public page looks the packet up by this, not by the token. */
export function onboardingTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
