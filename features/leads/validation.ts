import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import {
  BUDGET_RANGES,
  CONTACT_METHODS,
  CONTACT_TIMES,
  CONVERT_LIMITS,
  HIRING_TIMELINES,
  INDUSTRIES,
  LEAD_EVENT_LIMIT,
  LEAD_LIMITS,
  LEAD_PROFILE_LIMITS,
  LEAD_SOURCES,
  MARKETING_CONSENT,
  PRIORITIES,
  STAFF_COUNTS,
  TIMELINE_KINDS,
  TRIAGE_STATUSES,
  YEARS_IN_SERVICE,
  type ConvertField,
  type LeadField,
  type LeadPayload,
  type LeadProfileDetails,
  type LeadStatusField,
} from "./contract";

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

// Admin: timeline, edit, convert with remarks ----------------------------------------------------------

const remark = z
  .string({ error: "Enter a few words." })
  .trim()
  .min(1, "Enter a few words.")
  .max(LEAD_EVENT_LIMIT, tooLong("this", LEAD_EVENT_LIMIT))
  .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("this", LEAD_EVENT_LIMIT));

const stepSchema = z.strictObject({
  leadId: z.uuid({ error: FORM_ERROR }),
  kind: z.enum(TIMELINE_KINDS, { error: FORM_ERROR }),
  body: remark,
});

export type LeadStepInput = z.output<typeof stepSchema>;
export type LeadStepField = "body";

/** A call, qualification, junk remark, note or remark. The kind comes from the button, so a bad one is tampering. */
export const parseLeadStep = (input: unknown) => parseWith(stepSchema, input, ["body"] satisfies LeadStepField[]);

const optionalLine = (limit: number, name: string) =>
  z.string().trim().max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit)).default("");

const choice = (options: readonly string[]) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || options.includes(value), "Choose an option from the list.")
    .default("");

const profileSchema = z.strictObject({
  jobTitle: optionalLine(LEAD_PROFILE_LIMITS.jobTitle, "the job title"),
  phone: optionalLine(LEAD_PROFILE_LIMITS.phone, "the phone number"),
  source: choice(LEAD_SOURCES),
  street: optionalLine(LEAD_PROFILE_LIMITS.street, "the street"),
  city: optionalLine(LEAD_PROFILE_LIMITS.city, "the city"),
  state: optionalLine(LEAD_PROFILE_LIMITS.state, "the state"),
  zip: optionalLine(LEAD_PROFILE_LIMITS.zip, "the zip code"),
  yearsInService: choice(YEARS_IN_SERVICE),
  staffCount: choice(STAFF_COUNTS),
  droppedReason: optionalLine(LEAD_PROFILE_LIMITS.droppedReason, "the dropped reason"),
  budget: choice(BUDGET_RANGES),
  hiringTimeline: choice(HIRING_TIMELINES),
  decisionMaker: optionalLine(LEAD_PROFILE_LIMITS.decisionMaker, "the decision maker"),
  priority: choice(PRIORITIES),
  contactMethod: choice(CONTACT_METHODS),
  bestTime: choice(CONTACT_TIMES),
  consent: choice(MARKETING_CONSENT),
});

const PROFILE_FIELDS = [
  "jobTitle",
  "phone",
  "source",
  "street",
  "city",
  "state",
  "zip",
  "yearsInService",
  "staffCount",
  "droppedReason",
  "budget",
  "hiringTimeline",
  "decisionMaker",
  "priority",
  "contactMethod",
  "bestTime",
  "consent",
] as const satisfies readonly (keyof LeadProfileDetails)[];

export type LeadEditInput = { leadId: string; profile: LeadProfileDetails } & z.output<typeof adminLeadSchema>;

/** The profile editor. Core lead fields, plus every extra field on the overview. */
export function parseLeadEdit(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false as const, formError: FORM_ERROR };
  const record = input as Record<string, unknown>;
  const id = z.uuid().safeParse(record.leadId);
  if (!id.success) return { ok: false as const, formError: FORM_ERROR };
  const core: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "leadId") continue;
    if ((LEAD_FIELDS as readonly string[]).includes(key)) core[key] = value;
    else extra[key] = value;
  }
  const lead = parseAdminLead(core);
  const profile = parseWith(profileSchema, extra, PROFILE_FIELDS);
  if (!lead.ok || !profile.ok) {
    if (!lead.ok && "formError" in lead) return lead;
    if (!profile.ok && "formError" in profile) return profile;
    return {
      ok: false as const,
      fieldErrors: {
        ...(!lead.ok && "fieldErrors" in lead ? lead.fieldErrors : {}),
        ...(!profile.ok && "fieldErrors" in profile ? profile.fieldErrors : {}),
      },
    };
  }
  return { ok: true as const, value: { leadId: id.data, ...lead.value, profile: profile.value } };
}

export type ConvertNotedInput = ConvertInput & { remarks: string };
export type ConvertNotedField = ConvertField | "remarks";

/** Convert, plus the remark that lands on the timeline. */
export function parseConvertNoted(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false as const, formError: FORM_ERROR };
  const record = input as Record<string, unknown>;
  const { remarks, ...rest } = record;
  const converted = parseConvert(rest);
  const note = remark.safeParse(remarks);
  if (!converted.ok) {
    if ("fieldErrors" in converted && !note.success) {
      return { ok: false as const, fieldErrors: { ...converted.fieldErrors, remarks: note.error.issues[0]?.message ?? "Enter a few words." } };
    }
    return converted;
  }
  if (!note.success) return { ok: false as const, fieldErrors: { remarks: note.error.issues[0]?.message ?? "Enter a few words." } };
  return { ok: true as const, value: { ...converted.value, remarks: note.data } };
}

const idSchema = z.strictObject({ leadId: z.uuid({ error: FORM_ERROR }) });

export const parseLeadTarget = (input: unknown) => parseWith(idSchema, input, []);

const flagSchema = z.strictObject({
  leadId: z.uuid({ error: FORM_ERROR }),
  disabled: z.enum(["true", "false"], { error: FORM_ERROR }),
});

export type LeadFlagInput = { leadId: string; disabled: boolean };

export function parseLeadFlag(input: unknown) {
  const result = parseWith(flagSchema, input, []);
  if (!result.ok) return result;
  return { ok: true as const, value: { leadId: result.value.leadId, disabled: result.value.disabled === "true" } };
}
