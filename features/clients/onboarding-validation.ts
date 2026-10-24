import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { CLIENT_BILLING_LIMITS, CLIENT_BUSINESS_LIMITS, NEW_CLIENT_LIMITS, type ClientBilling, type ClientBusiness, type OnboardingField } from "./contract";
import { ONBOARDING_TOKEN } from "./onboarding-token";
import { choice, optionalLine } from "./validation";

const required = (limit: number, missing: string, name: string) =>
  z.string({ error: missing }).trim().min(1, missing).max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit));
const pick = (options: readonly string[], missing: string) =>
  z.string({ error: missing }).trim().refine((value) => options.includes(value), missing);

// The public onboarding form. Company details the team needs before a VA starts are required (the same ones
// companyDetailsComplete checks); billing needs a name and an email. The token is the gate: a malformed one
// is a tampered request, not a field error.
const onboardingSchema = z.strictObject({
  token: z.string({ error: FORM_ERROR }).regex(ONBOARDING_TOKEN, FORM_ERROR),
  contactName: required(NEW_CLIENT_LIMITS.contactName, "Enter your name.", "your name"),
  contactPhone: optionalLine(NEW_CLIENT_LIMITS.contactPhone, "the phone number"),
  jobTitle: optionalLine(CLIENT_BUSINESS_LIMITS.jobTitle, "the job title"),
  industry: pick(INDUSTRIES, "Choose your industry."),
  website: optionalLine(CLIENT_BUSINESS_LIMITS.website, "the website"),
  staffCount: choice(STAFF_COUNTS, "Choose a team size."),
  about: z
    .string({ error: "Tell us a little about the work." })
    .trim()
    .min(1, "Tell us a little about the work.")
    .max(CLIENT_BUSINESS_LIMITS.about, tooLong("the description", CLIENT_BUSINESS_LIMITS.about))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the description", CLIENT_BUSINESS_LIMITS.about)),
  street: optionalLine(CLIENT_BUSINESS_LIMITS.street, "the street"),
  city: required(CLIENT_BUSINESS_LIMITS.city, "Enter your city.", "the city"),
  state: optionalLine(CLIENT_BUSINESS_LIMITS.state, "the state"),
  zip: optionalLine(CLIENT_BUSINESS_LIMITS.zip, "the zip code"),
  country: pick(COUNTRIES, "Choose your country."),
  billingName: required(CLIENT_BILLING_LIMITS.name, "Enter the name to bill.", "the billing name"),
  billingEmail: emailField(CLIENT_BILLING_LIMITS.email),
  billingStreet: optionalLine(CLIENT_BILLING_LIMITS.street, "the street"),
  billingCity: optionalLine(CLIENT_BILLING_LIMITS.city, "the city"),
  billingState: optionalLine(CLIENT_BILLING_LIMITS.state, "the state"),
  billingZip: optionalLine(CLIENT_BILLING_LIMITS.zip, "the zip code"),
  billingCountry: choice(COUNTRIES, "Choose a country."),
  billingTaxId: optionalLine(CLIENT_BILLING_LIMITS.taxId, "the tax ID"),
  consent: z.literal(true, { error: "Please agree to the Terms and Privacy Policy to continue." }),
});

const FIELDS = Object.keys(onboardingSchema.shape).filter((key) => key !== "token") as OnboardingField[];

export type OnboardingInput = { token: string; contactName: string; contactPhone: string; business: ClientBusiness; billing: ClientBilling; consent: true };

// The database limits business and billing by bytes of their JSON (octet_length ≤ 4000 / 2000); characters
// outside ASCII take up to 4 bytes, so a long answer in, say, Japanese can pass the character limits and still
// not fit. Checked here, with room for jsonb's own spacing, so the client gets a field error, not a failure.
const BUSINESS_MAX_BYTES = 3800;
const BILLING_MAX_BYTES = 1800;
const jsonBytes = (value: object) => Buffer.byteLength(JSON.stringify(value), "utf8");

/** Validates the public onboarding form. Unknown keys or a bad token are a tampered request (400). */
export function parseOnboarding(input: unknown) {
  const parsed = parseWith(onboardingSchema, input, FIELDS);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const value = {
      token: v.token,
      contactName: v.contactName,
      contactPhone: v.contactPhone,
      business: {
        industry: v.industry,
        country: v.country,
        website: v.website,
        jobTitle: v.jobTitle,
        street: v.street,
        city: v.city,
        state: v.state,
        zip: v.zip,
        staffCount: v.staffCount,
        about: v.about,
      },
      billing: {
        name: v.billingName,
        email: v.billingEmail,
        street: v.billingStreet,
        city: v.billingCity,
        state: v.billingState,
        zip: v.billingZip,
        country: v.billingCountry,
        taxId: v.billingTaxId,
      },
      consent: v.consent,
    } satisfies OnboardingInput;
  const fieldErrors: Partial<Record<OnboardingField, string>> = {};
  if (jsonBytes(value.business) > BUSINESS_MAX_BYTES) fieldErrors.about = "Please shorten your answer a little; it's longer than we can store.";
  if (jsonBytes(value.billing) > BILLING_MAX_BYTES) fieldErrors.billingStreet = "Please shorten the billing details a little; they're longer than we can store.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false as const, fieldErrors };
  return { ok: true as const, value };
}

/** The token from the page URL, checked before any lookup. */
export const isOnboardingToken = (value: unknown): value is string => typeof value === "string" && ONBOARDING_TOKEN.test(value);
