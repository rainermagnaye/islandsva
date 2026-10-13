import "server-only";
import { z } from "zod";
import { packages } from "@/content/packages";
import { LEAD_LIMITS, type LeadField, type LeadFieldErrors, type LeadPayload } from "./contract";

const FORM_ERROR = "Something went wrong with the form. Please refresh the page and try again.";
const FIELDS = new Set<string>(["name", "email", "company", "message", "package"] satisfies LeadField[]);
const PACKAGE_SLUGS = new Set(packages.map((p) => p.slug));
// No control characters; the message may also contain \t \n \r.
const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;
const NO_CONTROL_CHARS_EXCEPT_WHITESPACE = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tooLong = (what: string, max: number) => `Keep ${what} under ${max} characters.`;
const emailIncomplete = "That email doesn't look complete — try name@company.com.";

// One entry per LeadPayload key (checked by `satisfies`); strictObject rejects any other key.
// Every string is trimmed before its checks run.
const leadShape = {
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(LEAD_LIMITS.name, tooLong("your name", LEAD_LIMITS.name))
    .regex(NO_CONTROL_CHARS, tooLong("your name", LEAD_LIMITS.name)),
  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address.")
    .max(LEAD_LIMITS.email, emailIncomplete)
    .regex(EMAIL_SHAPE, emailIncomplete),
  company: z
    .string({ error: "Enter a company name or leave it blank." })
    .trim()
    .max(LEAD_LIMITS.company, tooLong("the company name", LEAD_LIMITS.company))
    .regex(NO_CONTROL_CHARS, tooLong("the company name", LEAD_LIMITS.company))
    .default(""),
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
const leadSchema = z.strictObject(leadShape).transform(({ website, turnstileToken, company, package: packageSlug, ...rest }) => ({
  value: { ...rest, company: company || null, packageSlug: packageSlug || null },
  isBot: website !== "",
  turnstileToken: turnstileToken || null,
}));

/** A validated lead — derived from the schema, so the two can't drift apart. */
export type LeadInput = z.output<typeof leadSchema>["value"];

type ParseResult =
  | ({ ok: true } & z.output<typeof leadSchema>)
  | { ok: false; fieldErrors: LeadFieldErrors }
  // Not tied to a field the user can fix (tampered or stale form): shown as a form-level message.
  | { ok: false; formError: string };

/**
 * Validates the contact form body. Field problems come back keyed by input name (first message per field);
 * anything else — not an object, unknown keys, a malformed honeypot or token — is a form-level error.
 */
export function parseLead(input: unknown): ParseResult {
  const result = leadSchema.safeParse(input);
  if (!result.success) {
    const { issues } = result.error;
    if (issues.some((issue) => issue.code === "unrecognized_keys" || issue.path.length === 0)) {
      return { ok: false, formError: FORM_ERROR };
    }
    const fieldErrors: LeadFieldErrors = {};
    for (const issue of issues) {
      const field = issue.path[0];
      if (typeof field === "string" && FIELDS.has(field)) fieldErrors[field as LeadField] ??= issue.message;
    }
    return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: false, formError: FORM_ERROR };
  }

  return { ok: true, ...result.data };
}
