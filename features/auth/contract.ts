// Shared by the auth forms (input limits) and the server (validation.ts). No Zod: forms import this file.

/** 72 is bcrypt's input limit (Supabase Auth hashes with bcrypt); 10+ with letters and digits matches config.toml. */
export const PASSWORD_RULES = { min: 10, max: 72 } as const;

export type SignInField = "email" | "password";
export type EmailField = "email";
export type NewPasswordField = "password" | "confirmPassword";
export type MfaField = "code";

/** A new authenticator-app factor: the QR code is an SVG data URL, the secret is for manual entry. */
export type MfaEnrollment = { factorId: string; qrCode: string; secret: string };
export type EnrollmentResult = ({ ok: true } & MfaEnrollment) | { ok: false; message: string };

/** Reasons /auth/confirm sends people back to sign-in; shown as a message, never echoed from the URL. */
export const LINK_ERRORS = {
  expired: "That link has expired or was already used. Request a new one below.",
  invalid: "That link isn't valid. Request a new one below.",
  unavailable: "Sign-in is unavailable right now. Please try the link again in a few minutes.",
} as const;
export type LinkError = keyof typeof LINK_ERRORS;
