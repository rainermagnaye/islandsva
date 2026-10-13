import "server-only";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";

// Supabase Auth calls made as the visitor (publishable key + session cookie). Each returns null on success
// or the Auth error code the caller can act on (`invalid_credentials`, `over_request_rate_limit`, …).
// Outages and network failures throw UpstreamError instead, so callers show one "unavailable" message.

type AuthOutcome = string | null;

function outcome(error: AuthError | null): AuthOutcome {
  if (!error) return null;
  if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) {
    throw new UpstreamError("supabase-auth", error.message, { cause: error });
  }
  return error.code ?? "unknown";
}

export async function signInWithPassword(email: string, password: string): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.signInWithPassword({ email, password })).error);
}

/** Ends this browser's session only; the user's other devices stay signed in. */
export async function signOut(): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.signOut({ scope: "local" })).error);
}

/** Emails a reset link built by the "Reset password" template (→ /auth/confirm?type=recovery). */
export async function sendPasswordReset(email: string): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.resetPasswordForEmail(email)).error);
}

export async function updatePassword(password: string): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.updateUser({ password })).error);
}

/** Exchanges an emailed one-time token (invite or recovery) for a session cookie. */
export async function verifyEmailLink(type: "invite" | "recovery", tokenHash: string): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error);
}

/** The user's authenticator-app factors, verified and not. */
export async function listTotpFactors() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  outcome(error);
  return (data?.all ?? []).filter((factor) => factor.factor_type === "totp");
}

/**
 * Starts authenticator-app setup. Abandoned (unverified) setups are removed first so they don't pile up
 * against the per-user factor limit. Returns the QR code (SVG data URL) and the secret for manual entry.
 */
export async function enrollTotp() {
  const supabase = await createClient();
  for (const factor of await listTotpFactors()) {
    if (factor.status === "unverified") outcome((await supabase.auth.mfa.unenroll({ factorId: factor.id })).error);
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  const code = outcome(error);
  if (code || !data) return { ok: false as const, code: code ?? "unknown" };
  return { ok: true as const, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verifies a 6-digit code; on success the session is upgraded to aal2 and the cookie rewritten. */
export async function verifyTotp(factorId: string, code: string): Promise<AuthOutcome> {
  const supabase = await createClient();
  return outcome((await supabase.auth.mfa.challengeAndVerify({ factorId, code })).error);
}
