import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, parseWith, tooLong } from "@/lib/validation";
import { PAYMENT_LIMITS, type PaymentField } from "./activation-contract";

const paymentSchema = z.strictObject({
  clientId: z.uuid({ error: FORM_ERROR }),
  // Dollars as typed ("855", "855.00", "1,200.50"); stored as cents.
  amount: z
    .string({ error: "Enter the amount received." })
    .trim()
    .transform((value) => value.replace(/,/g, ""))
    .refine((value) => /^\d{1,7}(\.\d{1,2})?$/.test(value), "Enter the amount in US dollars, like 855 or 855.50.")
    .transform((value) => Math.round(Number(value) * 100))
    .refine((cents) => cents >= 1 && cents <= PAYMENT_LIMITS.maxCents, "Enter an amount between $0.01 and $1,000,000."),
  reference: z
    .string()
    .trim()
    .max(PAYMENT_LIMITS.reference, tooLong("the reference", PAYMENT_LIMITS.reference))
    .regex(NO_CONTROL_CHARS, "Use letters, numbers and punctuation only in the reference.")
    .default(""),
  paidOn: z.string({ error: "Choose the date it arrived." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it arrived."),
});

export type ManualPaymentInput = { clientId: string; amountCents: number; reference: string; paidOn: string };

/** "Mark as paid": the amount actually received, a bank or transfer reference, and the date (not in the future). */
export function parseManualPayment(input: unknown, now = new Date()) {
  const parsed = parseWith(paymentSchema, input, ["amount", "reference", "paidOn"] satisfies PaymentField[]);
  if (!parsed.ok) return parsed;
  const { clientId, amount, reference, paidOn } = parsed.value;
  const [year, month, day] = paidOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  // Same as the database: no later than today in UTC (its current_date), so the two never disagree.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (!real || date.getTime() > today) return { ok: false as const, fieldErrors: { paidOn: "Choose the date it arrived, today (UTC) or earlier." } };
  return { ok: true as const, value: { clientId, amountCents: amount, reference, paidOn } satisfies ManualPaymentInput };
}

const paymentIdSchema = z.strictObject({ clientId: z.uuid({ error: FORM_ERROR }), paymentId: z.uuid({ error: FORM_ERROR }) });

/** Void one payment of one client. A bad id is a tampered request. */
export const parsePaymentTarget = (input: unknown) => parseWith(paymentIdSchema, input, []);
