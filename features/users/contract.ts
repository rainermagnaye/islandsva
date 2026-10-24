import type { Role } from "@/lib/auth/roles";
import type { Enums } from "@/types/database";
import {
  GENDERS,
  MARITAL_STATUSES,
  REVIEW_SECTIONS,
  type MaritalStatus,
  type RegistrationStatus,
  type ReviewSection,
  type StaffGender,
} from "./staff-fields";

export {
  GENDERS,
  GENDER_CHOICES,
  GENDER_LABELS,
  MARITAL_CHOICES,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  REVIEW_SECTIONS,
  STAFF_LIMITS,
  USER_LIMITS,
  type MaritalStatus,
  type RegistrationStatus,
  type ReviewSection,
  type StaffGender,
} from "./staff-fields";

// Shared by the invite form and the server. No Zod: the form imports this file.
// Values the staff profile form needs in the browser live in ./staff-fields (re-exported above).

/** Roles an admin can invite directly. Clients are invited by a Closer during onboarding (M3). */
export const STAFF_ROLES = ["va", "closer", "admin"] as const satisfies readonly Role[];

export type InviteField = "email" | "fullName" | "role";

/** One row of the admin user list — only what the screen shows. */
export type UserSummary = {
  id: string;
  email: string;
  fullName: string;
  /** Mobile number from the staff profile, when one has been saved. */
  phone: string | null;
  roles: Role[];
  status: AccountStatus;
  /** Set on the first sign-in. A VA can be signed in and still not Active. */
  signedInAt: string | null;
  /** Null when this person has no staff profile yet. */
  reviewStatus: StaffReviewStatus | null;
  createdAt: string;
};

export type AccountStatus = Enums<"account_status">;

export const STATUS_LABELS: Record<AccountStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Deactivated",
};

export type StaffEmployer = { company: string; position: string; duration: string };

export type StaffReference = { name: string; phone: string; relationship: string; company: string; email: string };

/** The sections the progress tracker reports. A résumé can stand in for typed skills, not for experience. */
export const STAFF_SECTIONS = ["basic", "address", "contact", "education", "experience", "resume"] as const;
export type StaffSection = (typeof STAFF_SECTIONS)[number];

/** Inputs on the staff profile form that can show a field error (lists and the résumé report form-level). */
export type StaffDetailField = Exclude<keyof StaffDetails, "employers" | "references" | "resumeName">;

export type StaffDetails = {
  fullName: string;
  dateOfBirth: string;
  gender: StaffGender | "";
  nationality: string;
  maritalStatus: MaritalStatus | "";
  currentStreet: string;
  currentLine2: string;
  currentCity: string;
  currentProvince: string;
  currentPostalCode: string;
  currentCountry: string;
  mobileNumber: string;
  alternatePhone: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  highestEducation: string;
  certifications: string;
  skills: string;
  languages: string;
  employers: StaffEmployer[];
  references: StaffReference[];
  keyResponsibilities: string;
  achievements: string;
  resumeName: string;
};

export function emptyStaffDetails(fullName = ""): StaffDetails {
  return {
    fullName,
    dateOfBirth: "",
    gender: "",
    nationality: "",
    maritalStatus: "",
    currentStreet: "",
    currentLine2: "",
    currentCity: "",
    currentProvince: "",
    currentPostalCode: "",
    currentCountry: "",
    mobileNumber: "",
    alternatePhone: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    highestEducation: "",
    certifications: "",
    skills: "",
    languages: "",
    employers: [],
    references: [],
    keyResponsibilities: "",
    achievements: "",
    resumeName: "",
  };
}

const filled = (value: string) => value.trim().length > 0;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same calendar rule as the profile form: a real date, from 1900 through today. */
function isPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
}

/** Which sections have the details they need. A half-filled or invalid section stays open. Email on the account is not a section by itself. */
export function staffSections(details: StaffDetails): Record<StaffSection, boolean> {
  const employer = details.employers.some((job) => filled(job.company) && filled(job.position));
  const reference = details.references.some(
    (person) => filled(person.name) && EMAIL_SHAPE.test(person.email.trim()) && filled(person.phone) && filled(person.company) && filled(person.relationship),
  );
  return {
    basic: filled(details.fullName) && isPastDate(details.dateOfBirth) && (GENDERS as readonly string[]).includes(details.gender) && filled(details.nationality) && (MARITAL_STATUSES as readonly string[]).includes(details.maritalStatus),
    address: filled(details.currentStreet) && filled(details.currentCity) && filled(details.currentProvince) && filled(details.currentPostalCode),
    contact: filled(details.mobileNumber) && filled(details.emergencyName) && filled(details.emergencyRelationship) && filled(details.emergencyPhone),
    education: filled(details.highestEducation) && filled(details.skills) && filled(details.languages),
    experience: employer && filled(details.keyResponsibilities) && reference,
    resume: filled(details.resumeName),
  };
}

export const REVIEW_SECTION_LABELS: Record<ReviewSection, string> = {
  basic: "Basic details",
  address: "Address",
  contact: "Contacts",
  skills: "Skills",
  experience: "Experiences",
};

export type StaffReviewStatus = Enums<"staff_review_status">;

export function reviewSections(value: readonly string[]): ReviewSection[] {
  return value.filter((item): item is ReviewSection => (REVIEW_SECTIONS as readonly string[]).includes(item));
}

export function reviewSectionFilled(sections: Record<StaffSection, boolean>, section: ReviewSection): boolean {
  if (section === "skills") return sections.education || sections.resume;
  return sections[section];
}

/** First visit shows every section. A return shows the flagged ones, plus any that are still empty. */
export function openReviewSections(sections: Record<StaffSection, boolean>, returned: readonly ReviewSection[]): ReviewSection[] {
  if (returned.length === 0) return [...REVIEW_SECTIONS];
  return REVIEW_SECTIONS.filter((section) => returned.includes(section) || !reviewSectionFilled(sections, section));
}

/** A VA who is also an admin or a Closer uses that workspace, not this gate. */
export function isVaAccount(roles: readonly Role[]): boolean {
  return roles.includes("va") && !roles.includes("admin") && !roles.includes("closer");
}

/** The portal opens once an admin confirms the profile. An account that was already active stays open. */
export function vaPortalOpen(accountStatus: AccountStatus, review: StaffReviewStatus | null): boolean {
  if (accountStatus === "inactive") return false;
  if (review === "approved") return true;
  return review === null && accountStatus === "active";
}

export type AccessBadge = { label: string; tone: "info" | "success" | "warning" | "neutral"; validated: boolean };

/** The status on the profile and the team list. A confirmed VA also gets the check beside the name. */
export function staffAccessBadge(input: {
  roles: readonly Role[];
  accountStatus: AccountStatus;
  review: StaffReviewStatus | null;
  signedIn: boolean;
}): AccessBadge {
  if (!isVaAccount(input.roles)) {
    const tone = input.accountStatus === "active" ? "success" : input.accountStatus === "inactive" ? "neutral" : "info";
    return { label: STATUS_LABELS[input.accountStatus], tone, validated: false };
  }
  if (input.accountStatus === "inactive") return { label: STATUS_LABELS.inactive, tone: "neutral", validated: false };
  if (vaPortalOpen(input.accountStatus, input.review)) return { label: STATUS_LABELS.active, tone: "success", validated: true };
  if (input.review === "pending_review") return { label: "Pending Review", tone: "warning", validated: false };
  if (!input.signedIn) return { label: STATUS_LABELS.invited, tone: "info", validated: false };
  return { label: "Pending", tone: "warning", validated: false };
}

export const REGISTRATION_STEPS = [
  { id: "invitation", label: "Invitation sent" },
  { id: "password", label: "Password" },
  { id: "registration", label: "Registration" },
  { id: "review", label: "Review" },
  { id: "completed", label: "Completed" },
] as const;

export type RegistrationStep = { id: (typeof REGISTRATION_STEPS)[number]["id"]; label: string; done: boolean; current: boolean };

export type RegistrationProgress = {
  signedIn: boolean;
  review: StaffReviewStatus;
  returned: readonly ReviewSection[];
};

/**
 * Registration is one step. It checks only when every section is valid, and opens again when an admin sends a section back.
 * Invitation is always done. Skills is typed skills or a résumé. Experiences also needs a reference.
 */
export function registrationSteps(sections: Record<StaffSection, boolean>, progress: RegistrationProgress): RegistrationStep[] {
  const sentBack = progress.review === "pending" && progress.returned.length > 0;
  const locked = progress.review === "pending_review" || progress.review === "approved";
  const described = sections.basic && sections.address && sections.contact && (sections.education || sections.resume) && sections.experience;
  const confirmed = progress.review === "approved";
  const flags = [true, progress.signedIn, locked || (described && !sentBack), confirmed, confirmed];
  const firstOpen = flags.findIndex((done) => !done);
  const current = firstOpen === -1 ? flags.length - 1 : firstOpen;
  return REGISTRATION_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    done: flags[index],
    current: index === current,
  }));
}

/** Pending until a section is saved. Complete only when skills and experiences, including a reference, are in. */
export function registrationStatus(sections: Record<StaffSection, boolean>): RegistrationStatus {
  const described = sections.basic && sections.address && sections.contact && (sections.education || sections.resume) && sections.experience;
  if (described) return "completed";
  if (STAFF_SECTIONS.some((section) => sections[section])) return "in_progress";
  return "pending";
}
