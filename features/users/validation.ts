import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import {
  GENDERS,
  MARITAL_STATUSES,
  STAFF_LIMITS,
  STAFF_ROLES,
  USER_LIMITS,
  type InviteField,
  type StaffDetails,
  type StaffEmployer,
} from "./contract";

const inviteSchema = z.strictObject({
  email: emailField(USER_LIMITS.email),
  fullName: z
    .string({ error: "Enter their name." })
    .trim()
    .min(1, "Enter their name.")
    .max(USER_LIMITS.fullName, tooLong("the name", USER_LIMITS.fullName))
    .regex(NO_CONTROL_CHARS, tooLong("the name", USER_LIMITS.fullName)),
  role: z.enum(STAFF_ROLES, { error: "Choose a role." }),
});

export type InviteInput = z.output<typeof inviteSchema>;

export const parseInvite = (input: unknown) => parseWith(inviteSchema, input, ["email", "fullName", "role"] satisfies InviteField[]);

const staffIdSchema = z.strictObject({
  userId: z.uuid({ error: FORM_ERROR }),
});

export const parseStaffId = (input: unknown) => parseWith(staffIdSchema, input, [] as const);

/** YYYY-MM-DD that exists on the calendar — "2026-02-31" has the right shape but the database rejects it. */
function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const line = (max: number, label: string) =>
  z.string().trim().max(max, tooLong(label, max)).regex(NO_CONTROL_CHARS, tooLong(label, max));

const notes = (max: number, label: string) =>
  z.string().trim().max(max, tooLong(label, max)).regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong(label, max));

const staffDetailsSchema = z.strictObject({
  fullName: z.string().trim().min(1, "Enter their name.").max(USER_LIMITS.fullName, tooLong("the name", USER_LIMITS.fullName)).regex(NO_CONTROL_CHARS, tooLong("the name", USER_LIMITS.fullName)),
  dateOfBirth: z
    .string()
    .trim()
    .refine((value) => value === "" || isCalendarDate(value), "Enter a real date of birth.")
    .refine((value) => {
      if (!value) return true;
      return value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
    }, "Enter a date of birth in the past."),
  gender: z.union([z.literal(""), z.enum(GENDERS)]),
  nationality: line(STAFF_LIMITS.nationality, "the nationality"),
  maritalStatus: z.union([z.literal(""), z.enum(MARITAL_STATUSES)]),
  currentStreet: line(STAFF_LIMITS.street, "the street"),
  currentCity: line(STAFF_LIMITS.city, "the city"),
  currentProvince: line(STAFF_LIMITS.province, "the province"),
  currentPostalCode: line(STAFF_LIMITS.postalCode, "the postal code"),
  permanentStreet: line(STAFF_LIMITS.street, "the street"),
  permanentCity: line(STAFF_LIMITS.city, "the city"),
  permanentProvince: line(STAFF_LIMITS.province, "the province"),
  permanentPostalCode: line(STAFF_LIMITS.postalCode, "the postal code"),
  mobileNumber: line(STAFF_LIMITS.phone, "the mobile number"),
  alternatePhone: line(STAFF_LIMITS.phone, "the phone number"),
  emergencyName: line(STAFF_LIMITS.emergencyName, "the emergency contact"),
  emergencyRelationship: line(STAFF_LIMITS.relationship, "the relationship"),
  emergencyPhone: line(STAFF_LIMITS.phone, "the emergency phone"),
  highestEducation: line(STAFF_LIMITS.education, "the education"),
  certifications: notes(STAFF_LIMITS.certifications, "the certifications"),
  skills: line(STAFF_LIMITS.skills, "the skills"),
  languages: line(STAFF_LIMITS.languages, "the languages"),
  keyResponsibilities: notes(STAFF_LIMITS.responsibilities, "the responsibilities"),
  achievements: notes(STAFF_LIMITS.achievements, "the achievements"),
});

export type StaffDetailsInput = z.output<typeof staffDetailsSchema>;

const DETAIL_FIELDS = [
  "fullName",
  "dateOfBirth",
  "gender",
  "nationality",
  "maritalStatus",
  "currentStreet",
  "currentCity",
  "currentProvince",
  "currentPostalCode",
  "permanentStreet",
  "permanentCity",
  "permanentProvince",
  "permanentPostalCode",
  "mobileNumber",
  "alternatePhone",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
  "highestEducation",
  "certifications",
  "skills",
  "languages",
  "keyResponsibilities",
  "achievements",
] as const satisfies readonly (keyof StaffDetailsInput)[];

export const parseStaffDetails = (input: unknown) => parseWith(staffDetailsSchema, input, DETAIL_FIELDS);

const jobLine = (max: number) => z.string().trim().max(max, tooLong("that entry", max)).regex(NO_CONTROL_CHARS, tooLong("that entry", max));

/** Parallel employer fields from the form. Blank rows are dropped. */
export function parseEmployers(companies: string[], positions: string[], durations: string[]): { ok: true; value: StaffEmployer[] } | { ok: false; message: string } {
  if (companies.length > STAFF_LIMITS.employers) return { ok: false, message: `Keep the work history to ${STAFF_LIMITS.employers} employers.` };
  const employers: StaffEmployer[] = [];
  for (let i = 0; i < companies.length; i += 1) {
    const company = jobLine(STAFF_LIMITS.employer).safeParse(companies[i] ?? "");
    const position = jobLine(STAFF_LIMITS.employer).safeParse(positions[i] ?? "");
    const duration = jobLine(STAFF_LIMITS.employer).safeParse(durations[i] ?? "");
    if (!company.success || !position.success || !duration.success) return { ok: false, message: "Check the work history. Each entry is too long or has an unusual character." };
    if (!company.data && !position.data && !duration.data) continue;
    employers.push({ company: company.data, position: position.data, duration: duration.data });
  }
  return { ok: true, value: employers };
}

export function withEmployers(details: StaffDetailsInput, employers: StaffEmployer[], resumeName: string): StaffDetails {
  return { ...details, employers, resumeName };
}
