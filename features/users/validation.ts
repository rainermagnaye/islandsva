import "server-only";
import { z } from "zod";
import { FORM_ERROR, NO_CONTROL_CHARS, NO_CONTROL_CHARS_EXCEPT_WHITESPACE, emailField, parseWith, tooLong } from "@/lib/validation";
import {
  GENDERS,
  MARITAL_STATUSES,
  REVIEW_SECTIONS,
  EMPLOYEE_LIMITS,
  EMPLOYEE_ROLES,
  USER_LIMITS,
  TIME_FORMATS,
  type InviteField,
  type MyProfileField,
  type EmployeeDetails,
  type EmployeeEmployer,
  type EmployeeReference,
} from "./contract";

const inviteSchema = z.strictObject({
  email: emailField(USER_LIMITS.email),
  fullName: z
    .string({ error: "Enter their name." })
    .trim()
    .min(1, "Enter their name.")
    .max(USER_LIMITS.fullName, tooLong("the name", USER_LIMITS.fullName))
    .regex(NO_CONTROL_CHARS, tooLong("the name", USER_LIMITS.fullName)),
  role: z.enum(EMPLOYEE_ROLES, { error: "Choose a role." }),
});

export type InviteInput = z.output<typeof inviteSchema>;

export const parseInvite = (input: unknown) => parseWith(inviteSchema, input, ["email", "fullName", "role"] satisfies InviteField[]);

const employeeIdSchema = z.strictObject({
  userId: z.uuid({ error: FORM_ERROR }),
});

export const parseEmployeeId = (input: unknown) => parseWith(employeeIdSchema, input, [] as const);

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

const employeeDetailsSchema = z.strictObject({
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
  nationality: line(EMPLOYEE_LIMITS.nationality, "the nationality"),
  maritalStatus: z.union([z.literal(""), z.enum(MARITAL_STATUSES)]),
  currentStreet: line(EMPLOYEE_LIMITS.street, "the street"),
  currentLine2: line(EMPLOYEE_LIMITS.street, "the additional info"),
  currentCity: line(EMPLOYEE_LIMITS.city, "the city"),
  currentProvince: line(EMPLOYEE_LIMITS.province, "the state"),
  currentPostalCode: line(EMPLOYEE_LIMITS.postalCode, "the postal code"),
  currentCountry: line(EMPLOYEE_LIMITS.country, "the country"),
  mobileNumber: line(EMPLOYEE_LIMITS.phone, "the mobile number"),
  alternatePhone: line(EMPLOYEE_LIMITS.phone, "the phone number"),
  emergencyName: line(EMPLOYEE_LIMITS.emergencyName, "the emergency contact"),
  emergencyRelationship: line(EMPLOYEE_LIMITS.relationship, "the relationship"),
  emergencyPhone: line(EMPLOYEE_LIMITS.phone, "the emergency phone"),
  highestEducation: line(EMPLOYEE_LIMITS.education, "the education"),
  certifications: notes(EMPLOYEE_LIMITS.certifications, "the certifications"),
  skills: line(EMPLOYEE_LIMITS.skills, "the skills"),
  languages: line(EMPLOYEE_LIMITS.languages, "the languages"),
  keyResponsibilities: notes(EMPLOYEE_LIMITS.responsibilities, "the responsibilities"),
  achievements: notes(EMPLOYEE_LIMITS.achievements, "the achievements"),
});

export type EmployeeDetailsInput = z.output<typeof employeeDetailsSchema>;

const DETAIL_FIELDS = [
  "fullName",
  "dateOfBirth",
  "gender",
  "nationality",
  "maritalStatus",
  "currentStreet",
  "currentLine2",
  "currentCity",
  "currentProvince",
  "currentPostalCode",
  "currentCountry",
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
] as const satisfies readonly (keyof EmployeeDetailsInput)[];

export const parseEmployeeDetails = (input: unknown) => parseWith(employeeDetailsSchema, input, DETAIL_FIELDS);

/** Phone and time format from My Profile. Name, email and languages are not accepted here. */
export const parseMyProfile = (input: unknown) =>
  parseWith(
    z.strictObject({
      mobileNumber: employeeDetailsSchema.shape.mobileNumber,
      timeFormat: z.enum(TIME_FORMATS, { error: "Choose a time format." }),
    }),
    input,
    ["mobileNumber", "timeFormat"] satisfies MyProfileField[],
  );

const jobLine = (max: number) => z.string().trim().max(max, tooLong("that entry", max)).regex(NO_CONTROL_CHARS, tooLong("that entry", max));

/** Parallel employer fields from the form. Blank rows are dropped. */
export function parseEmployers(companies: string[], positions: string[], durations: string[]): { ok: true; value: EmployeeEmployer[] } | { ok: false; message: string } {
  if (companies.length > EMPLOYEE_LIMITS.employers) return { ok: false, message: `Keep the work history to ${EMPLOYEE_LIMITS.employers} employers.` };
  const employers: EmployeeEmployer[] = [];
  for (let i = 0; i < companies.length; i += 1) {
    const company = jobLine(EMPLOYEE_LIMITS.employer).safeParse(companies[i] ?? "");
    const position = jobLine(EMPLOYEE_LIMITS.employer).safeParse(positions[i] ?? "");
    const duration = jobLine(EMPLOYEE_LIMITS.employer).safeParse(durations[i] ?? "");
    if (!company.success || !position.success || !duration.success) return { ok: false, message: "Check the work history. Each entry is too long or has an unusual character." };
    if (!company.data && !position.data && !duration.data) continue;
    employers.push({ company: company.data, position: position.data, duration: duration.data });
  }
  return { ok: true, value: employers };
}

/** Parallel reference fields from the form. Blank rows are dropped. */
export function parseReferences(names: string[], phones: string[], relationships: string[], companies: string[], emails: string[]): { ok: true; value: EmployeeReference[] } | { ok: false; message: string } {
  if (names.length > EMPLOYEE_LIMITS.references) return { ok: false, message: `Keep references to ${EMPLOYEE_LIMITS.references} people.` };
  const references: EmployeeReference[] = [];
  for (let i = 0; i < names.length; i += 1) {
    const name = jobLine(EMPLOYEE_LIMITS.emergencyName).safeParse(names[i] ?? "");
    const phone = jobLine(EMPLOYEE_LIMITS.phone).safeParse(phones[i] ?? "");
    const relationship = jobLine(EMPLOYEE_LIMITS.relationship).safeParse(relationships[i] ?? "");
    const company = jobLine(EMPLOYEE_LIMITS.employer).safeParse(companies[i] ?? "");
    const email = parseReferenceEmail(emails[i] ?? "");
    if (!name.success || !phone.success || !relationship.success || !company.success || !email.ok) {
      return { ok: false, message: "Check the references. Each entry is too long, or the email doesn't look complete." };
    }
    if (!name.data && !phone.data && !relationship.data && !company.data && !email.value) continue;
    references.push({ name: name.data, phone: phone.data, relationship: relationship.data, company: company.data, email: email.value });
  }
  return { ok: true, value: references };
}

function parseReferenceEmail(value: string): { ok: true; value: string } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  const parsed = emailField(USER_LIMITS.email).safeParse(trimmed);
  if (!parsed.success) return { ok: false };
  return { ok: true, value: parsed.data };
}

export function withEmployers(details: EmployeeDetailsInput, employers: EmployeeEmployer[], references: EmployeeReference[], resumeName: string): EmployeeDetails {
  return { ...details, employers, references, resumeName };
}

const reviewReturnSchema = z.strictObject({
  userId: z.uuid({ error: FORM_ERROR }),
  note: z.string().trim().max(EMPLOYEE_LIMITS.returnNote, tooLong("the note", EMPLOYEE_LIMITS.returnNote)).regex(NO_CONTROL_CHARS_EXCEPT_WHITESPACE, tooLong("the note", EMPLOYEE_LIMITS.returnNote)),
  sections: z.array(z.enum(REVIEW_SECTIONS)).min(1, "Choose a section to send back."),
});

export const parseReviewReturn = (input: unknown) => parseWith(reviewReturnSchema, input, ["note", "sections"] as const);
