import "server-only";
import { createHash, randomBytes } from "node:crypto";

// The onboarding link's secret: 256 random bits, URL-safe. Only its SHA-256 is stored, so a database
// leak can't be turned into working links; the token itself exists only in the email and the copy shown once.

export const ONBOARDING_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const hashOnboardingToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createOnboardingToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashOnboardingToken(token) };
}
