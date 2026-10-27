import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, parseWith, tooLong } from "@/lib/validation";
import { BOOKING_LIMITS, DISCOVERY_LIMITS, discoveryStart, type BookingField, type BookingNoteField, type DiscoveryTimesField } from "./contract";

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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const idList = z
  .array(z.uuid({ error: "Choose someone from the list." }))
  .max(BOOKING_LIMITS.guests, `Invite at most ${BOOKING_LIMITS.guests} people.`);

const when = (kind: "date" | "time") =>
  z
    .string({ error: kind === "date" ? "Choose a date." : "Enter a time." })
    .trim()
    .regex(kind === "date" ? DATE : TIME, kind === "date" ? "Choose a date." : "Enter a time.");

const bookingSchema = z
  .strictObject({
    meetingId: z.uuid({ error: FORM_ERROR }).optional(),
    title: z
      .string({ error: "Enter a meeting title." })
      .trim()
      .min(1, "Enter a meeting title.")
      .max(BOOKING_LIMITS.title, tooLong("the title", BOOKING_LIMITS.title))
      .regex(NO_CONTROL_CHARS, "Enter a meeting title."),
    startDate: when("date"),
    startTime: when("time"),
    endDate: when("date"),
    endTime: when("time"),
    clientIds: idList.default([]),
    staffIds: idList.default([]),
    note: z
      .string()
      .trim()
      .max(BOOKING_LIMITS.note, tooLong("the note", BOOKING_LIMITS.note))
      .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the note", BOOKING_LIMITS.note))
      .default(""),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(`${value.startDate}T${value.startTime}:00+08:00`);
    const end = Date.parse(`${value.endDate}T${value.endTime}:00+08:00`);
    const span = end - start;
    if (Number.isNaN(start) || Number.isNaN(end) || span <= 0 || span > BOOKING_LIMITS.hours * 3_600_000) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End the meeting after it starts, within 8 hours." });
    }
    if (value.clientIds.length + value.staffIds.length > BOOKING_LIMITS.guests) {
      ctx.addIssue({ code: "custom", path: ["clientIds"], message: `Invite at most ${BOOKING_LIMITS.guests} people.` });
    }
  });

const noteSchema = z.strictObject({
  meetingId: z.uuid({ error: FORM_ERROR }),
  note: z
    .string({ error: "Enter a note." })
    .trim()
    .min(1, "Enter a note.")
    .max(BOOKING_LIMITS.note, tooLong("the note", BOOKING_LIMITS.note))
    .regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the note", BOOKING_LIMITS.note)),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingNoteInput = z.infer<typeof noteSchema>;

const BOOKING_FIELDS = ["title", "startDate", "startTime", "endDate", "endTime", "clientIds", "staffIds", "note"] as const satisfies readonly BookingField[];

export function parseBooking(input: unknown) {
  return parseWith(bookingSchema, input, BOOKING_FIELDS);
}

export function parseBookingNote(input: unknown) {
  return parseWith(noteSchema, input, ["note"] as const satisfies readonly BookingNoteField[]);
}

const noteEditSchema = z.strictObject({
  eventId: z.uuid({ error: FORM_ERROR }),
  note: noteSchema.shape.note,
});

export function parseBookingNoteEdit(input: unknown) {
  return parseWith(noteEditSchema, input, ["note"] as const satisfies readonly BookingNoteField[]);
}

export function parseBookingEventId(input: unknown) {
  return parseWith(z.strictObject({ eventId: z.uuid({ error: FORM_ERROR }) }), input, ["eventId"] as const);
}

export function parseBookingId(input: unknown) {
  return parseWith(z.strictObject({ meetingId: z.uuid({ error: FORM_ERROR }) }), input, ["meetingId"] as const);
}

const discoveryMoveSchema = z.strictObject({
  meetingId: z.uuid({ error: FORM_ERROR }),
  startDate: when("date"),
  startTime: when("time"),
}).superRefine((value, ctx) => {
  const start = discoveryStart(value.startDate, value.startTime);
  if (!start.ok) ctx.addIssue({ code: "custom", path: ["startTime"], message: start.message });
}).transform((value) => {
  const start = discoveryStart(value.startDate, value.startTime);
  return { meetingId: value.meetingId, startsAt: start.ok ? start.startsAt : "" };
});

export function parseDiscoveryMove(input: unknown) {
  return parseWith(discoveryMoveSchema, input, ["startDate", "startTime"] as const satisfies readonly BookingField[]);
}
