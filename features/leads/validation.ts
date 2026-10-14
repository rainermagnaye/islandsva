import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import { CONVERT_LIMITS, INDUSTRIES, LEAD_LIMITS, TRIAGE_STATUSES, type ConvertField, type LeadField, type LeadPayload, type LeadStatusField } from "./contract";

const LEAD_FIELDS = ["name", "email", "company", "industry", "country", "message", "package"] as const satisfies readonly LeadField[];
const PACKAGE_SLUGS = new Set(packages.map((p) => p.slug));
const COUNTRY_NAMES: readonly string[] = COUNTRIES;
const INDUSTRY_NAMES: readonly string[] = INDUSTRIES;

// One entry per LeadPayload key (checked by `satisfies`); strictObject rejects any other key.
// Every string is trimmed before its checks run.
const leadShape = {
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(LEAD_LIMITS.name, tooLong("your name", LEAD_LIMITS.name))
    .regex(NO_CONTROL_CHARS, tooLong("your name", LEAD_LIMITS.name)),
  email: emailField(LEAD_LIMITS.email),
  company: z
    .string({ error: "Enter your company name." })
    .trim()
    .min(1, "Enter your company name.")
    .max(LEAD_LIMITS.company, tooLong("the company name", LEAD_LIMITS.company))
    .regex(NO_CONTROL_CHARS, tooLong("the company name", LEAD_LIMITS.company)),
  industry: z
    .string({ error: "Choose an industry." })
    .trim()
    .refine((name) => INDUSTRY_NAMES.includes(name), "Choose an industry."),
  country: z
    .string({ error: "Choose a country." })
    .trim()
    .refine((name) => COUNTRY_NAMES.includes(name), "Choose a country."),
  package: z
    .string({ error: "Choose a package from the list." })
    .trim()
    .refine((slug) => slug === "" || PACKAGE_SLUGS.has(slug), "Choose a package from the list.")
    .default(""),
  message: z
    .string({ error: "Tell us a little about what you need." })
    .trim()
    .min(1, "Tell us a little about what you need.")
    .max(LEAD_LIMITS.message, tooLong("your message", LEAD_LIMITS.message))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("your message", LEAD_LIMITS.message)),
  website: z.string().trim().default(""),
  turnstileToken: z.string().trim().max(4096).default(""),
} satisfies Record<keyof LeadPayload, z.ZodType>;

// Output: the validated lead (the only shape that reaches the database) plus the anti-spam fields the
// route needs. Empty optional strings become null so the DB stores NULL, not "".
const leadSchema = z.strictObject(leadShape).transform(({ website, turnstileToken, package: packageSlug, ...rest }) => ({
  value: { ...rest, packageSlug: packageSlug || null },
  isBot: website !== "",
  turnstileToken: turnstileToken || null,
}));

/** A validated lead — derived from the schema, so the two can't drift apart. */
export type LeadInput = z.output<typeof leadSchema>["value"];

/** Validates the contact form body (see parseWith for how errors are reported). */
export function parseLead(input: unknown) {
  const result = parseWith(leadSchema, input, LEAD_FIELDS);
  return result.ok ? { ok: true as const, ...result.value } : result;
}

// Admin: "Convert to client" -----------------------------------------------------------------------------

const optionalPhone = z
  .string()
  .trim()
  .max(CONVERT_LIMITS.contactPhone, tooLong("the phone number", CONVERT_LIMITS.contactPhone))
  .regex(NO_CONTROL_CHARS, tooLong("the phone number", CONVERT_LIMITS.contactPhone))
  .default("");

const convertSchema = z
  .strictObject({
    leadId: z.uuid({ error: FORM_ERROR }),
    companyName: z
      .string({ error: "Enter the client's company name." })
      .trim()
      .min(1, "Enter the client's company name.")
      .max(CONVERT_LIMITS.companyName, tooLong("the company name", CONVERT_LIMITS.companyName))
      .regex(NO_CONTROL_CHARS, tooLong("the company name", CONVERT_LIMITS.companyName)),
    contactName: z
      .string({ error: "Enter the contact's name." })
      .trim()
      .min(1, "Enter the contact's name.")
      .max(CONVERT_LIMITS.contactName, tooLong("the name", CONVERT_LIMITS.contactName))
      .regex(NO_CONTROL_CHARS, tooLong("the name", CONVERT_LIMITS.contactName)),
    contactPhone: optionalPhone,
  })
  .transform(({ contactPhone, ...rest }) => ({ ...rest, contactPhone: contactPhone || null }));

export type ConvertInput = z.output<typeof convertSchema>;

/** Validates the "Convert to client" form. A bad lead id is a tampered form (form-level error). */
export const parseConvert = (input: unknown) =>
  parseWith(convertSchema, input, ["companyName", "contactName", "contactPhone"] satisfies ConvertField[]);

// Admin: change a lead's status -------------------------------------------------------------------------

const statusSchema = z.strictObject({
  leadId: z.uuid({ error: FORM_ERROR }),
  // Only the hand-set statuses: "converted" comes from converting the lead, never from this form.
  status: z.enum(TRIAGE_STATUSES, { error: FORM_ERROR }),
});

export type LeadStatusInput = z.output<typeof statusSchema>;

/** Validates a status button's form. Both values come from hidden inputs, so any problem is a tampered form. */
export const parseLeadStatus = (input: unknown) => parseWith(statusSchema, input, [] satisfies LeadStatusField[]);

// Admin: create a lead by hand -----------------------------------------------------------------------

const incompleteEmail = "That email doesn't look complete — try name@company.com.";

const adminLeadSchema = z
  .strictObject({
    name: z
      .string({ error: "Enter their name." })
      .trim()
      .min(1, "Enter their name.")
      .max(LEAD_LIMITS.name, tooLong("the name", LEAD_LIMITS.name))
      .regex(NO_CONTROL_CHARS, tooLong("the name", LEAD_LIMITS.name)),
    email: z
      .string({ error: "Enter their email address." })
      .trim()
      .toLowerCase()
      .min(1, "Enter their email address.")
      .max(LEAD_LIMITS.email, incompleteEmail)
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, incompleteEmail),
    company: z
      .string({ error: "Enter their company name." })
      .trim()
      .min(1, "Enter their company name.")
      .max(LEAD_LIMITS.company, tooLong("the company name", LEAD_LIMITS.company))
      .regex(NO_CONTROL_CHARS, tooLong("the company name", LEAD_LIMITS.company)),
    industry: z
      .string({ error: "Choose an industry." })
      .trim()
      .refine((name) => INDUSTRY_NAMES.includes(name), "Choose an industry."),
    country: z
      .string({ error: "Choose a country." })
      .trim()
      .refine((name) => COUNTRY_NAMES.includes(name), "Choose a country."),
    package: z
      .string({ error: "Choose a package from the list." })
      .trim()
      .refine((slug) => slug === "" || PACKAGE_SLUGS.has(slug), "Choose a package from the list.")
      .default(""),
    message: z
      .string({ error: "Say what they need." })
      .trim()
      .min(1, "Say what they need.")
      .max(LEAD_LIMITS.message, tooLong("the message", LEAD_LIMITS.message))
      .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the message", LEAD_LIMITS.message)),
  })
  .transform(({ package: packageSlug, ...rest }) => ({ ...rest, packageSlug: packageSlug || null }));

/** Validates the admin "Create Lead" form. Same stored shape as a discovery-call submission. */
export const parseAdminLead = (input: unknown) => parseWith(adminLeadSchema, input, LEAD_FIELDS);
