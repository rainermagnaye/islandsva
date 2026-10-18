import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, parseWith, tooLong } from "@/lib/validation";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { CLIENT_BUSINESS_LIMITS, CLIENT_NOTE_LIMIT, type ClientBusiness, type ClientDetailField, type ClientNoteField } from "./contract";

const CLIENT_LIMITS = { companyName: 160, contactName: 120, contactPhone: 40 } as const;

const optionalLine = (limit: number, name: string) =>
  z.string().trim().max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit)).default("");

const choice = (options: readonly string[], empty: string) =>
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
