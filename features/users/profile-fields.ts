import { COUNTRIES } from "@/content/countries";
import type { MaritalStatus, RegistrationStatus, StaffGender } from "./contract";

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

/** Street, city, province and postal code, one per line. A single comma-separated line is accepted too. */
export function formatAddress(street: string, city: string, province: string, postal: string) {
  return [street, city, province, postal].map((part) => part.trim()).filter(Boolean).join("\n");
}

export function splitAddress(text: string) {
  const lines = text.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    street: parts[0] ?? "",
    city: parts[1] ?? "",
    province: parts[2] ?? "",
    postal: parts.slice(3).join(" "),
  };
}

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

export function genderChoices(current: StaffGender | "") {
  return withCurrent(["male", "female", "non_binary"] as const, current);
}

export function maritalChoices(current: MaritalStatus | "") {
  return withCurrent(["single", "married", "widowed", "divorced"] as const, current);
}

export type StaffProfileMeta = {
  registrationStatus: RegistrationStatus;
  invitationSentAt: string;
  registrationCompletedAt: string | null;
  progress: string;
};

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatProfileDate(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : when.format(date);
}
