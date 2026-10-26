import "server-only";
import { z } from "zod";
import { FORM_ERROR, parseWith } from "@/lib/validation";

const offerSchema = z.strictObject({
  clientId: z.uuid({ error: FORM_ERROR }),
  vaId: z.uuid({ error: "Choose a VA." }),
});

const decisionSchema = z.strictObject({
  shortlistId: z.uuid({ error: FORM_ERROR }),
  status: z.enum(["accepted", "declined"], { error: FORM_ERROR }),
});

const shortlistIdSchema = z.strictObject({ shortlistId: z.uuid({ error: FORM_ERROR }) });

const halfHour = (label: string) =>
  z.coerce
    .number({ error: `Choose a ${label}.` })
    .int(`Choose a ${label}.`)
    .refine((minute) => minute % 30 === 0, `Choose a ${label} on the hour or half hour.`);

const hoursSchema = z.strictObject({
  weekday: z.coerce.number({ error: "Choose a day." }).int("Choose a day.").min(1, "Choose a day.").max(7, "Choose a day."),
  startMinute: halfHour("start"),
  endMinute: halfHour("end"),
});

const weekdaySchema = z.strictObject({
  weekday: z.coerce.number({ error: FORM_ERROR }).int().min(1).max(7),
});

export type OfferField = "vaId";
export type HoursField = "weekday" | "startMinute" | "endMinute";

export const parseOffer = (input: unknown) => parseWith<typeof offerSchema, OfferField>(offerSchema, input, ["vaId"]);
export const parseDecision = (input: unknown) => parseWith(decisionSchema, input, []);
export const parseWithdraw = (input: unknown) => parseWith(shortlistIdSchema, input, []);

export function parseHours(input: unknown) {
  const parsed = parseWith<typeof hoursSchema, HoursField>(hoursSchema, input, ["weekday", "startMinute", "endMinute"]);
  if (!parsed.ok) return parsed;
  if (parsed.value.endMinute <= parsed.value.startMinute || parsed.value.startMinute > 1410 || parsed.value.endMinute > 1440) {
    return { ok: false as const, fieldErrors: { endMinute: "End the window after it starts." } };
  }
  return parsed;
}

export const parseRemoveHours = (input: unknown) => parseWith(weekdaySchema, input, []);
