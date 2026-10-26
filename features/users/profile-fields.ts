import { COUNTRIES } from "@/content/countries";
import { GENDER_CHOICES, MARITAL_CHOICES, type MaritalStatus, type RegistrationStatus, type EmployeeGender, type TimeFormat } from "./contract";

export { COUNTRIES };

/** Shown in the education dropdown. A saved value outside this list stays selectable. */
export const EDUCATION_LEVELS = ["High School", "Bachelor's", "Master's", "Doctorate"] as const;

export const LANGUAGES = [
  "English",
  "Filipino",
  "Tagalog",
  "Cebuano",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Arabic",
  "Hindi",
  "Mandarin",
  "Cantonese",
  "Japanese",
  "Korean",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Malay",
  "Russian",
] as const;

const RANGE = /^(\d{4}-\d{2}-\d{2})\s+[–-]\s+(\d{4}-\d{2}-\d{2})$/;

/** A stored duration is either a date range or older free text such as "2019–2022". */
export function splitDuration(duration: string) {
  const match = duration.trim().match(RANGE);
  return match ? { start: match[1], end: match[2] } : { start: "", end: "" };
}

export function joinDuration(start: string, end: string, previous: string) {
  if (start && end) return `${start} – ${end}`;
  if (!start && !end) return previous;
  return start || end;
}

export function withCurrent<T extends string>(choices: readonly T[], current: string): T[] {
  if (!current || choices.includes(current as T)) return [...choices];
  return [current as T, ...choices];
}

export function genderChoices(current: EmployeeGender | "") {
  return withCurrent(GENDER_CHOICES, current);
}

export function maritalChoices(current: MaritalStatus | "") {
  return withCurrent(MARITAL_CHOICES, current);
}

export type EmployeeProfileMeta = {
  registrationStatus: RegistrationStatus;
  invitationSentAt: string;
  registrationCompletedAt: string | null;
  progress: string;
  timeFormat: TimeFormat;
};

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatProfileDate(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : when.format(date);
}
