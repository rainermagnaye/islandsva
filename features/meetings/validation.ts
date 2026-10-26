import "server-only";
import { z } from "zod";
import { FORM_ERROR, parseWith } from "@/lib/validation";
import { DISCOVERY_LIMITS, type DiscoveryTimesField } from "./contract";

const HALF_HOUR = /^([01]\d|2[0-3]):(00|30)$/;

const timesSchema = z.strictObject({
  times: z
    .array(z.string({ error: FORM_ERROR }), { error: FORM_ERROR })
    // An unticked form sends nothing; a stray empty value is dropped, not an error.
    .transform((times) => times.filter((time) => time !== ""))
    .pipe(
      z
        .array(z.string().regex(HALF_HOUR, "Choose times on the hour or half hour."))
        .max(DISCOVERY_LIMITS.maxTimes, `Choose at most ${DISCOVERY_LIMITS.maxTimes} times.`)
        .refine((times) => new Set(times).size === times.length, "Choose each time once."),
    )
    .transform((times) => [...times].sort()),
});

/**
 * "Discovery calls" settings: the daily times (Philippine time, on :00 or :30), at most six, each once, returned
 * in order. An empty list is allowed: it stops offering calls.
 */
export const parseDiscoveryTimes = (input: unknown) =>
  parseWith<typeof timesSchema, DiscoveryTimesField>(timesSchema, input, ["times"]);
