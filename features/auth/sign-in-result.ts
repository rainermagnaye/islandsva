// What a failed password sign-in tells the visitor, by Supabase Auth error code. Pure, so it is tested
// without Supabase. Outages (network, 5xx) never get here — the dal turns them into UpstreamError.

export const SIGN_IN_MESSAGES = {
  credentials: "That email and password don't match. Check them or reset your password.",
  rateLimited: "Too many attempts. Wait a few minutes, then try again.",
  unavailable: "Sign-in is unavailable right now. Please try again in a few minutes.",
  unknown: "We couldn't sign you in. Please try again.",
} as const;

// The project itself is misconfigured (email sign-in switched off in the dashboard, a wrong or revoked
// key): nothing the visitor can fix, so say sign-in is unavailable and flag it for whoever runs the project.
const CONFIGURATION_ERRORS = new Set(["email_provider_disabled", "provider_disabled", "no_authorization", "bad_jwt", "invalid_api_key"]);

export type SignInFailure = {
  message: string;
  /** Worth an error log: an operator problem, or a code this map doesn't know yet. */
  report: "configuration" | "unexpected" | null;
};

export function signInFailure(code: string): SignInFailure {
  // One message for every credential failure, so the form never reveals which emails have accounts.
  if (code === "invalid_credentials") return { message: SIGN_IN_MESSAGES.credentials, report: null };
  if (code === "over_request_rate_limit") return { message: SIGN_IN_MESSAGES.rateLimited, report: null };
  if (CONFIGURATION_ERRORS.has(code)) return { message: SIGN_IN_MESSAGES.unavailable, report: "configuration" };
  return { message: SIGN_IN_MESSAGES.unknown, report: "unexpected" };
}
