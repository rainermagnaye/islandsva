import "server-only";
import { z } from "zod";
import { packages } from "@/content/packages";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong, utcDay } from "@/lib/validation";
import { PACKAGE_TIMEZONES } from "@/features/leads/contract";
import { CLIENT_REVIEW_SECTIONS, NEW_CLIENT_LIMITS, PAYMENT_RECEIVED_LIMITS, type NewClientField, type PaymentReceivedField } from "./contract";
import { CLIENT_REVIEW_NOTE_LIMIT } from "./registration";
import { optionalLine } from "./validation";

// A client a Closer adds by hand, an admin's review of a registration packet, and the payment recorded when
// it's confirmed.

const DAY = 86_400_000;

const PACKAGE_SLUGS: readonly string[] = packages.map((item) => item.slug);

const TIMEZONE_VALUES: readonly string[] = PACKAGE_TIMEZONES.map((zone) => zone.value);

const requiredClientLine = (limit: number, missing: string, name: string) =>
  z.string({ error: missing }).trim().min(1, missing).max(limit, tooLong(name, limit)).regex(NO_CONTROL_CHARS, tooLong(name, limit));

const newClientSchema = z.strictObject({
  companyName: requiredClientLine(NEW_CLIENT_LIMITS.companyName, "Enter the company name.", "the company name"),
  contactName: requiredClientLine(NEW_CLIENT_LIMITS.contactName, "Enter the contact's name.", "the name"),
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

const reviewSchema = z.strictObject({
  clientId: z.uuid({ error: FORM_ERROR }),
  sections: z.array(z.enum(CLIENT_REVIEW_SECTIONS)).min(1, "Choose a section to send back."),
  note: z
    .string()
    .trim()
    .max(CLIENT_REVIEW_NOTE_LIMIT, tooLong("the note", CLIENT_REVIEW_NOTE_LIMIT))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the note", CLIENT_REVIEW_NOTE_LIMIT)),
});

export type ClientReviewInput = z.output<typeof reviewSchema>;

/** Sections to send back. At least one is required; the note is optional. */
export const parseClientReview = (input: unknown) => parseWith(reviewSchema, input, ["note", "sections"] as const);

const MONEY = /^\d{1,7}(\.\d{1,2})?$/;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const cents = (value: string) => Math.round(Number(value) * 100);

/**
 * "Confirm registration": the payment received, which the sales summary totals. Amount and fee are USD with up to
 * two decimals; the fee (bank or transfer) defaults to 0 and can't exceed the amount; the date is today or earlier
 * (UTC, as the database checks). `today` is a parameter so the rule is testable.
 */
export function parsePaymentReceived(input: unknown, today = new Date().toISOString().slice(0, 10)) {
  const schema = z
    .strictObject({
      clientId: z.uuid({ error: FORM_ERROR }),
      amount: z.string({ error: "Enter the amount received." }).trim().regex(MONEY, "Enter the amount received, like 855.00.").transform(cents),
      fee: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || "0")
        .pipe(z.string().regex(MONEY, "Enter the fee, like 15.00, or leave it empty."))
        .transform(cents),
      paidOn: z
        .string({ error: "Enter the date the payment arrived." })
        .regex(ISO_DAY, "Enter the date the payment arrived.")
        .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && day <= today, "The date can't be in the future."),
      reference: z
        .string()
        .trim()
        .max(PAYMENT_RECEIVED_LIMITS.reference, tooLong("the reference", PAYMENT_RECEIVED_LIMITS.reference))
        .regex(NO_CONTROL_CHARS, "Remove any unusual characters from the reference.")
        .optional()
        .transform((value) => value || null),
    })
    .superRefine((value, ctx) => {
      if (value.amount < 1 || value.amount > PAYMENT_RECEIVED_LIMITS.maxAmountCents) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above 0." });
      else if (value.fee > value.amount) ctx.addIssue({ code: "custom", path: ["fee"], message: "The fee can't be more than the amount." });
    });
  return parseWith<typeof schema, PaymentReceivedField>(schema, input, ["amount", "fee", "paidOn", "reference"]);
}

export type PaymentReceivedInput = Extract<ReturnType<typeof parsePaymentReceived>, { ok: true }>["value"];
