// What the contact form and POST /api/v1/leads agree on. No Zod here on purpose: the form imports this file,
// and keeping the schema (validation.ts, server-only) out of it keeps Zod out of the browser bundle.

/** Length limits — form `maxLength` and server checks. Mirrored by CHECK constraints on the leads table. */
export const LEAD_LIMITS = { name: 120, email: 254, company: 160, message: 5000 } as const;

/** Exact JSON body of POST /api/v1/leads. */
export type LeadPayload = {
  name: string;
  email: string;
  company: string;
  package: string;
  message: string;
  /** Honeypot — people leave it empty. */
  website: string;
  turnstileToken: string;
};

/** Form inputs that can show a field error (matches the input `name`s). */
export type LeadField = "name" | "email" | "company" | "message" | "package";
export type LeadFieldErrors = Partial<Record<LeadField, string>>;

/** `data` of a successful POST /api/v1/leads. Nothing about the stored lead is exposed. */
export type LeadCreated = { ok: true };
