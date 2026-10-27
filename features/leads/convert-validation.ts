import "server-only";
import { z } from "zod";
import { packages } from "@/content/packages";
import { FORM_ERROR, NO_CONTROL_CHARS, parseWith, tooLong, utcDay } from "@/lib/validation";
import { CONVERT_LIMITS, type ConvertField } from "./contract";
import { PACKAGE_SLUGS, remark } from "./validation";

// Admin: "Convert to client" — the plain convert and the one that confirms a package and writes a remark.

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

const DAY = 86_400_000;

const packageSetupSchema = z.strictObject({
  package: z
    .string({ error: "Choose a package." })
    .trim()
    .refine((slug) => PACKAGE_SLUGS.has(slug), "Choose a package."),
  hoursPerWeek: z.enum(["20", "40", "80"], { error: "Choose the hours for this package." }),
  termMonths: z.enum(["1", "6", "12"], { error: "Choose how long they'll commit." }),
  startsOn: z.string({ error: "Choose a start date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
});

const SETUP_FIELDS = ["package", "hoursPerWeek", "termMonths", "startsOn"] as const;

export type ConvertNotedInput = ConvertInput & {
  remarks: string;
  packageSlug: string;
  hoursPerWeek: 20 | 40 | 80;
  termMonths: 1 | 6 | 12;
  startsOn: string;
};

export type ConvertNotedField = ConvertField | "remarks" | (typeof SETUP_FIELDS)[number];

function todayUtc() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Convert, the package they're confirming, and the remark that lands on the timeline.
 * The monthly price is not an input — the server reads it from the package catalogue.
 */
export function parseConvertNoted(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false as const, formError: FORM_ERROR };
  const record = input as Record<string, unknown>;
  const { remarks, package: packageSlug, hoursPerWeek, termMonths, startsOn, timezone, ...rest } = record;
  void timezone;
  const converted = parseConvert(rest);
  const setup = parseWith(packageSetupSchema, { package: packageSlug, hoursPerWeek, termMonths, startsOn }, SETUP_FIELDS);
  const note = remark.safeParse(remarks);

  const fieldErrors: Partial<Record<ConvertNotedField, string>> = {};
  if (!converted.ok && "fieldErrors" in converted) Object.assign(fieldErrors, converted.fieldErrors);
  if (!setup.ok && "fieldErrors" in setup) Object.assign(fieldErrors, setup.fieldErrors);
  if (!note.success) fieldErrors.remarks = note.error.issues[0]?.message ?? "Enter a few words.";
  if (!converted.ok && "formError" in converted) return converted;
  if (!setup.ok && "formError" in setup) return setup;

  if (setup.ok) {
    const pkg = packages.find((item) => item.slug === setup.value.package);
    if (!pkg || String(pkg.weeklyHours) !== setup.value.hoursPerWeek) {
      fieldErrors.hoursPerWeek = "Choose the hours that come with this package.";
    }
    const start = utcDay(setup.value.startsOn);
    const today = todayUtc();
    if (start === null || start < today - DAY || start > today + 366 * DAY) {
      fieldErrors.startsOn = "Choose a start date from today through the next year.";
    }
  }

  if (!converted.ok || !setup.ok || !note.success || fieldErrors.hoursPerWeek || fieldErrors.startsOn) {
    return { ok: false as const, fieldErrors };
  }

  return {
    ok: true as const,
    value: {
      ...converted.value,
      remarks: note.data,
      packageSlug: setup.value.package,
      hoursPerWeek: Number(setup.value.hoursPerWeek) as 20 | 40 | 80,
      termMonths: Number(setup.value.termMonths) as 1 | 6 | 12,
      startsOn: setup.value.startsOn,
    },
  };
}
