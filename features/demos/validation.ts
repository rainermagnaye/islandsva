import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, parseWith } from "@/lib/validation";
import { DEMO_LIMITS, SLOT_TIMES, manilaToIso, type BookField, type SlotField } from "./contract";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (value: string) => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/**
 * "Add slots": a Manila date and one or more 30-minute start times. Each slot must start in the future and at
 * most 30 days ahead (the database refuses the rest). `now` is a parameter so the rule is testable.
 */
export function parseNewSlots(input: unknown, now = new Date()) {
  const schema = z
    .strictObject({
      date: z.string({ error: "Choose a date." }).refine(realDate, "Choose a date."),
      times: z.array(z.enum(SLOT_TIMES as [string, ...string[]], { error: FORM_ERROR }), { error: "Pick at least one time." }).min(1, "Pick at least one time."),
    })
    .transform(({ date, times }) => ({ startsAt: [...new Set(times)].sort().map((time) => manilaToIso(date, time)) }))
    .superRefine(({ startsAt }, ctx) => {
      const latest = now.getTime() + DEMO_LIMITS.publishDays * 24 * 3600 * 1000;
      if (startsAt.some((start) => Date.parse(start) <= now.getTime())) {
        ctx.addIssue({ code: "custom", path: ["times"], message: "Pick times that are still ahead." });
      } else if (startsAt.some((start) => Date.parse(start) > latest)) {
        ctx.addIssue({ code: "custom", path: ["date"], message: `Add slots up to ${DEMO_LIMITS.publishDays} days ahead.` });
      }
    });
  return parseWith<typeof schema, SlotField>(schema, input, ["date", "times"]);
}

const slotSchema = z.strictObject({ slotId: z.uuid({ error: FORM_ERROR }) });
export const parseSlotId = (input: unknown) => parseWith(slotSchema, input, []);

const bookingSchema = z.strictObject({
  slotId: z.uuid({ error: "Pick a time." }),
  note: z
    .string()
    .trim()
    .max(DEMO_LIMITS.note, `Keep the note under ${DEMO_LIMITS.note} characters.`)
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the note.")
    .optional()
    .transform((note) => note || null),
});
/** "Book a demo": the chosen time (a slot id) and an optional note for the VA. */
export const parseBooking = (input: unknown) => parseWith<typeof bookingSchema, BookField>(bookingSchema, input, ["slotId", "note"]);

const bookingIdSchema = z.strictObject({ bookingId: z.uuid({ error: FORM_ERROR }) });
export const parseBookingId = (input: unknown) => parseWith(bookingIdSchema, input, []);

const decisionSchema = z.strictObject({
  bookingId: z.uuid({ error: FORM_ERROR }),
  decision: z.enum(["confirmed", "rejected"], { error: FORM_ERROR }),
  reason: z
    .string()
    .trim()
    .max(DEMO_LIMITS.reason, `Keep the reason under ${DEMO_LIMITS.reason} characters.`)
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, "Remove any unusual characters from the reason.")
    .optional()
    .transform((reason) => reason || null),
});
/** A VA's answer to a demo request. A reason is kept only when declining (the database ignores it otherwise). */
export const parseDecision = (input: unknown) => parseWith<typeof decisionSchema, "reason">(decisionSchema, input, ["reason"]);
