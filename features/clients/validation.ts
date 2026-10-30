import "server-only";
import { z } from "zod";
import { COUNTRIES } from "@/content/countries";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import {
  CLIENT_BUSINESS_LIMITS,
  CLIENT_NOTE_LIMIT,
  CREATE_CLIENT_LIMITS,
  VA_MESSAGE_LIMIT,
  type ClientBusiness,
  type ClientDetailField,
  type ClientNoteField,
  type CreateClientField,
  type VaMessageField,
} from "./contract";
import { TOKEN_SHAPE } from "./token";

const CLIENT_LIMITS = { companyName: 160, contactName: 120, contactPhone: 40 } as const;

export const optionalLine = (limit: number, name: string) =>
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

const createSchema = z
  .strictObject({
    companyName: z
      .string({ error: "Enter the company name." })
      .trim()
      .min(1, "Enter the company name.")
      .max(CREATE_CLIENT_LIMITS.companyName, tooLong("the company name", CREATE_CLIENT_LIMITS.companyName))
      .regex(NO_CONTROL_CHARS, tooLong("the company name", CREATE_CLIENT_LIMITS.companyName)),
    contactName: z
      .string({ error: "Enter the contact's name." })
      .trim()
      .min(1, "Enter the contact's name.")
      .max(CREATE_CLIENT_LIMITS.contactName, tooLong("the name", CREATE_CLIENT_LIMITS.contactName))
      .regex(NO_CONTROL_CHARS, tooLong("the name", CREATE_CLIENT_LIMITS.contactName)),
    contactEmail: emailField(CREATE_CLIENT_LIMITS.contactEmail),
    contactPhone: optionalLine(CREATE_CLIENT_LIMITS.contactPhone, "the phone number"),
  })
  .transform(({ contactPhone, ...client }) => ({ ...client, contactPhone: contactPhone || null }));

export type CreateClientInput = z.output<typeof createSchema>;

const CREATE_CLIENT_FIELDS = ["companyName", "contactName", "contactEmail", "contactPhone"] as const satisfies readonly CreateClientField[];

/** A client added from the list, with no lead behind it. */
export const parseCreateClient = (input: unknown) => parseWith(createSchema, input, CREATE_CLIENT_FIELDS);

const requiredChoice = (options: readonly string[], empty: string) =>
  z.string({ error: empty }).trim().refine((value) => options.includes(value), empty);

const requiredLine = (limit: number, name: string, empty: string) =>
  z
    .string({ error: empty })
    .trim()
    .min(1, empty)
    .max(limit, tooLong(name, limit))
    .regex(NO_CONTROL_CHARS, tooLong(name, limit));

/** The registration link's token: a bad one is a tampered form, never a field to fix. */
export const registrationToken = z.string().regex(TOKEN_SHAPE, FORM_ERROR);

/** The company details the registration link's details step asks for. */
export const registrationDetailsShape = {
  token: registrationToken,
  companyName: requiredLine(CLIENT_LIMITS.companyName, "the company name", "Enter the company name."),
  contactName: requiredLine(CLIENT_LIMITS.contactName, "the name", "Enter the contact's name."),
  contactPhone: optionalLine(CLIENT_LIMITS.contactPhone, "the phone number"),
  industry: requiredChoice(INDUSTRIES, "Choose an industry."),
  country: requiredChoice(COUNTRIES, "Choose a country."),
  website: optionalLine(CLIENT_BUSINESS_LIMITS.website, "the website"),
  jobTitle: optionalLine(CLIENT_BUSINESS_LIMITS.jobTitle, "the job title"),
  street: optionalLine(CLIENT_BUSINESS_LIMITS.street, "the street"),
  city: requiredLine(CLIENT_BUSINESS_LIMITS.city, "the city", "Enter the city."),
  state: optionalLine(CLIENT_BUSINESS_LIMITS.state, "the state"),
  zip: optionalLine(CLIENT_BUSINESS_LIMITS.zip, "the zip code"),
  staffCount: choice(STAFF_COUNTS, "Choose a team size."),
  about: z
    .string({ error: "Describe the business." })
    .trim()
    .min(1, "Describe the business.")
    .max(CLIENT_BUSINESS_LIMITS.about, tooLong("the description", CLIENT_BUSINESS_LIMITS.about))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the description", CLIENT_BUSINESS_LIMITS.about)),
};

const idSchema = z.strictObject({ clientId: z.uuid({ error: FORM_ERROR }) });

export const parseClientId = (input: unknown) => parseWith(idSchema, input, []);

const assignmentIdSchema = z.strictObject({ assignmentId: z.uuid({ error: FORM_ERROR }) });

export const parseAssignmentId = (input: unknown) => parseWith(assignmentIdSchema, input, []);

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

const vaMessageSchema = z.strictObject({
  vaId: z.uuid({ error: FORM_ERROR }),
  body: z
    .string({ error: "Write a message." })
    .trim()
    .min(1, "Write a message.")
    .max(VA_MESSAGE_LIMIT, tooLong("the message", VA_MESSAGE_LIMIT))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the message."),
});

/** A note from the client to one assigned VA. The VA id is a hidden field. */
export const parseVaMessage = (input: unknown) => parseWith<typeof vaMessageSchema, VaMessageField>(vaMessageSchema, input, ["body"]);
