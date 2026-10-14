"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/content/routes";
import { homeFor, rolesFromClaims, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { EmailField, EnrollmentResult, MfaField, NewPasswordField, SignInField } from "./contract";
import * as auth from "./dal";
import { SIGN_IN_MESSAGES, signInFailure } from "./sign-in-result";
import { parseEmail, parseMfaCode, parseNewPassword, parseSignIn } from "./validation";

// Every export here is a public POST endpoint: each validates its input and, where it needs a session,
// re-checks it — never trust that the caller came from our page.

const UNAVAILABLE = SIGN_IN_MESSAGES.unavailable;
const TOO_MANY = SIGN_IN_MESSAGES.rateLimited;

// A symbol, not a string, so it can never collide with an Auth error code.
const OUTAGE = Symbol("outage");

/** Runs an Auth call; an outage becomes OUTAGE (logged) so the form shows a message, not an error page. */
async function attempt<T>(call: () => Promise<T>): Promise<T | typeof OUTAGE> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Supabase Auth unavailable", { service: error.service, error });
    return OUTAGE;
  }
}

export async function signIn(formData: FormData): Promise<SubmitResult<SignInField>> {
  const parsed = parseSignIn(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const { email, password, next } = parsed.value;

  const result = await attempt(() => auth.signInWithPassword(email, password));
  if (result === OUTAGE) return { ok: false, message: UNAVAILABLE };
  const { code, claims } = result;
  if (code) {
    const failure = signInFailure(code);
    // The code goes in the message text: some log sinks (the dev log file) drop object fields as "{}".
    if (failure.report) console.error(`Sign-in failed (${failure.report}): ${code}`);
    return { ok: false, message: failure.message };
  }

  // Straight to the user's workspace — an admin's page sends them through two-factor first. /dashboard is
  // the fallback for accounts without a role yet.
  redirect(safeNextPath(next, homeFor(rolesFromClaims(claims)) ?? appRoutes.dashboard));
}

export async function signOut(): Promise<void> {
  await attempt(auth.signOut);
  redirect(appRoutes.login);
}

export async function requestPasswordReset(formData: FormData): Promise<SubmitResult<EmailField>> {
  const parsed = parseEmail(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  const code = await attempt(() => auth.sendPasswordReset(parsed.value.email));
  if (code === OUTAGE) return { ok: false, message: UNAVAILABLE };
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return { ok: false, message: TOO_MANY };
  // Same success for unknown addresses (Supabase sends nothing then): no account enumeration.
  return { ok: true };
}

/** Auth codes the user fixes by choosing a different password. */
const PASSWORD_REJECTED: Partial<Record<string, string>> = {
  same_password: "Choose a password you haven't used here before.",
  weak_password: "That password is too easy to guess. Try a longer one.",
};

export async function setPassword(formData: FormData): Promise<SubmitResult<NewPasswordField>> {
  const user = await requireUser();
  const parsed = parseNewPassword(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  const code = await attempt(() => auth.updatePassword(parsed.value.password));
  if (code === OUTAGE) return { ok: false, message: UNAVAILABLE };
  const rejected = code && PASSWORD_REJECTED[code];
  if (rejected) return { ok: false, message: FIELD_ERRORS, fieldErrors: { password: rejected } };
  if (code === "reauthentication_needed") {
    return { ok: false, message: "For your security, request a new reset link and try again." };
  }
  if (code) return { ok: false, message: "We couldn't save your password. Please try again." };

  // Straight to their workspace (admins pass through /mfa there); /dashboard only without a role.
  redirect(homeFor(user.roles) ?? appRoutes.dashboard);
}

/** Creates the authenticator-app factor on demand; the QR code and secret go to the setup screen. */
export async function startMfaEnrollment(): Promise<EnrollmentResult> {
  await requireUser();
  const enrollment = await attempt(auth.enrollTotp);
  if (enrollment === OUTAGE) return { ok: false, message: UNAVAILABLE };
  return enrollment.ok ? enrollment : { ok: false, message: "We couldn't start setup. Please try again." };
}

/** Confirms a 6-digit code: finishes setup, or upgrades this session to two-factor (aal2). */
export async function verifyMfa(formData: FormData): Promise<SubmitResult<MfaField>> {
  const user = await requireUser();
  const parsed = parseMfaCode(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  const code = await attempt(() => auth.verifyTotp(parsed.value.factorId, parsed.value.code));
  if (code === OUTAGE) return { ok: false, message: UNAVAILABLE };
  if (code === "over_request_rate_limit") return { ok: false, message: TOO_MANY };
  if (code) {
    return { ok: false, message: FIELD_ERRORS, fieldErrors: { code: "That code didn't work. Use the newest code in your app." } };
  }

  // Roles don't change with the second factor, so the pre-upgrade session already knows the destination.
  redirect(homeFor(user.roles) ?? appRoutes.dashboard);
}
