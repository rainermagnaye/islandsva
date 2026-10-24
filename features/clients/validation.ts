import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import { INDUSTRIES, PACKAGE_TIMEZONES, STAFF_COUNTS } from "@/features/leads/contract";
import {
  CLIENT_BUSINESS_LIMITS,
  CLIENT_NOTE_LIMIT,
  NEW_CLIENT_LIMITS,
  type ClientBusiness,
  type ClientDetailField,
  type ClientNoteField,
  type NewClientField,
} from "./contract";

const CLIENT_LIMITS = { companyName: 160, contactName: 120, contactPhone: 40 } as const;

export const optionalLine = (limit: number, name: string) =>
  z.string().trim().max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit)).default("");

export const choice = (options: readonly string[], empty: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || options.includes(value), empty)
    .default("");

const detailsSchema = z
  .strictObject({
    clientId: z.uuid({ error: FORM_ERROR }),
    companyName: z
      .string({ error: "Enter the company name." })
      .trim()
      .min(1, "Enter the company name.")
      .max(CLIENT_LIMITS.companyName, tooLong("the company name", CLIENT_LIMITS.companyName))
      .regex(NO_CONTROL_CHARS, tooLong("the company name", CLIENT_LIMITS.companyName)),
    contactName: z
      .string({ error: "Enter the contact's name." })
      .trim()
      .min(1, "Enter the contact's name.")
      .max(CLIENT_LIMITS.contactName, tooLong("the name", CLIENT_LIMITS.contactName))
      .regex(NO_CONTROL_CHARS, tooLong("the name", CLIENT_LIMITS.contactName)),
    contactPhone: optionalLine(CLIENT_LIMITS.contactPhone, "the phone number"),
    industry: choice(INDUSTRIES, "Choose an industry."),
    country: choice(COUNTRIES, "Choose a country."),
    website: optionalLine(CLIENT_BUSINESS_LIMITS.website, "the website"),
    jobTitle: optionalLine(CLIENT_BUSINESS_LIMITS.jobTitle, "the job title"),
    street: optionalLine(CLIENT_BUSINESS_LIMITS.street, "the street"),
    city: optionalLine(CLIENT_BUSINESS_LIMITS.city, "the city"),
    state: optionalLine(CLIENT_BUSINESS_LIMITS.state, "the state"),
    zip: optionalLine(CLIENT_BUSINESS_LIMITS.zip, "the zip code"),
    staffCount: choice(STAFF_COUNTS, "Choose a team size."),
    about: z
      .string()
      .trim()
      .max(CLIENT_BUSINESS_LIMITS.about, tooLong("the description", CLIENT_BUSINESS_LIMITS.about))
      .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the description", CLIENT_BUSINESS_LIMITS.about))
      .default(""),
  })
  .transform(({ contactPhone, clientId, companyName, contactName, ...business }) => ({
    clientId,
    companyName,
    contactName,
    contactPhone: contactPhone || null,
    business: business satisfies ClientBusiness,
  }));

export type ClientDetailsInput = z.output<typeof detailsSchema>;

export const CLIENT_DETAIL_FIELDS = [
  "companyName",
  "contactName",
  "contactPhone",
  "industry",
  "country",
  "website",
  "jobTitle",
  "street",
  "city",
  "state",
  "zip",
  "staffCount",
  "about",
] as const satisfies readonly ClientDetailField[];

/** Company details on the client profile. A bad client id is a tampered form. */
export const parseClientDetails = (input: unknown) => parseWith(detailsSchema, input, CLIENT_DETAIL_FIELDS);

const idSchema = z.strictObject({ clientId: z.uuid({ error: FORM_ERROR }) });

const assignSchema = z.strictObject({ clientId: z.uuid({ error: FORM_ERROR }), vaId: z.uuid({ error: "Choose a VA." }) });

/** Assigning a VA: a bad client id is a tampered form; a missing VA is a field error. */
export const parseVaAssignment = (input: unknown) => parseWith(assignSchema, input, ["vaId"]);

export const parseClientId = (input: unknown) => parseWith(idSchema, input, []);

const noteSchema = z.strictObject({
  clientId: z.uuid({ error: FORM_ERROR }),
  body: z
    .string({ error: "Enter a note." })
    .trim()
    .min(1, "Enter a note.")
    .max(CLIENT_NOTE_LIMIT, tooLong("the note", CLIENT_NOTE_LIMIT))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the note", CLIENT_NOTE_LIMIT)),
});

export type ClientNoteInput = z.output<typeof noteSchema>;

/** A note on the client. A bad client id is a tampered form. */
export const parseClientNote = (input: unknown) => parseWith(noteSchema, input, ["body"] satisfies ClientNoteField[]);

const flagSchema = z.strictObject({
  clientId: z.uuid({ error: FORM_ERROR }),
  disabled: z.enum(["true", "false"], { error: FORM_ERROR }),
});

export type ClientFlagInput = { clientId: string; disabled: boolean };

/** Disable or enable. A bad id or flag is a tampered form. */
export function parseClientFlag(input: unknown) {
  const result = parseWith(flagSchema, input, []);
  if (!result.ok) return result;
  return { ok: true as const, value: { clientId: result.value.clientId, disabled: result.value.disabled === "true" } };
}

const DAY = 86_400_000;
const PACKAGE_SLUGS: readonly string[] = packages.map((item) => item.slug);
const TIMEZONE_VALUES: readonly string[] = PACKAGE_TIMEZONES.map((zone) => zone.value);
const requiredLine = (limit: number, missing: string, name: string) =>
  z.string({ error: missing }).trim().min(1, missing).max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit));

const newClientSchema = z.strictObject({
  companyName: requiredLine(NEW_CLIENT_LIMITS.companyName, "Enter the company name.", "the company name"),
  contactName: requiredLine(NEW_CLIENT_LIMITS.contactName, "Enter the contact's name.", "the name"),
  contactEmail: emailField(NEW_CLIENT_LIMITS.contactEmail),
  contactPhone: optionalLine(NEW_CLIENT_LIMITS.contactPhone, "the phone number"),
  package: z.string({ error: "Choose a package." }).trim().refine((slug) => PACKAGE_SLUGS.includes(slug), "Choose a package."),
  hoursPerWeek: z.enum(["20", "40", "80"], { error: "Choose the hours for this package." }),
  termMonths: z.enum(["1", "6", "12"], { error: "Choose how long they'll commit." }),
  startsOn: z.string({ error: "Choose a start date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
  timezone: z.string({ error: "Choose their time zone." }).refine((zone) => TIMEZONE_VALUES.includes(zone), "Choose their time zone."),
});

export type NewClientInput = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  packageSlug: string;
  hoursPerWeek: 20 | 40 | 80;
  termMonths: 1 | 6 | 12;
  startsOn: string;
  timezone: string;
};

/** UTC midnight for a calendar day, or null when it isn't a real date. */
function utcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

/**
 * A client a Closer adds by hand. The hours must be the package's own; the start date runs from today through
 * the next year. The monthly price is not an input — the server reads it from the package catalogue.
 */
export function parseNewClient(input: unknown, now = new Date()) {
  const parsed = parseWith(newClientSchema, input, Object.keys(newClientSchema.shape) as NewClientField[]);
  if (!parsed.ok) return parsed;
  const { package: packageSlug, hoursPerWeek, termMonths, startsOn, contactPhone, ...rest } = parsed.value;
  const fieldErrors: Partial<Record<NewClientField, string>> = {};
  const pkg = packages.find((item) => item.slug === packageSlug);
  if (!pkg || String(pkg.weeklyHours) !== hoursPerWeek) fieldErrors.hoursPerWeek = "Choose the hours that come with this package.";
  const start = utcDay(startsOn);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (start === null || start < today - DAY || start > today + 366 * DAY) fieldErrors.startsOn = "Choose a start date from today through the next year.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false as const, fieldErrors };
  return {
    ok: true as const,
    value: {
      ...rest,
      contactPhone: contactPhone || null,
      packageSlug,
      hoursPerWeek: Number(hoursPerWeek) as 20 | 40 | 80,
      termMonths: Number(termMonths) as 1 | 6 | 12,
      startsOn,
    } satisfies NewClientInput,
  };
}
