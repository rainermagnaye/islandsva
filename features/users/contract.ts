import type { Role } from "@/lib/auth/roles";
import type { Enums } from "@/types/database";

// Shared by the invite form and the server. No Zod: the form imports this file.

/** Roles an admin can invite directly. Clients are invited by a Closer during onboarding (M3). */
export const STAFF_ROLES = ["va", "closer", "admin"] as const satisfies readonly Role[];

export const USER_LIMITS = { fullName: 120, email: 254 } as const;

export type InviteField = "email" | "fullName" | "role";

/** One row of the admin user list — only what the screen shows. */
export type UserSummary = {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: AccountStatus;
  createdAt: string;
};

export type AccountStatus = Enums<"account_status">;

export const STATUS_LABELS: Record<AccountStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Deactivated",
};

export const STAFF_LIMITS = {
  nationality: 80,
  street: 160,
  city: 80,
  province: 80,
  postalCode: 20,
  phone: 40,
  emergencyName: 120,
  relationship: 40,
  education: 160,
  certifications: 500,
  skills: 500,
  languages: 200,
  responsibilities: 2000,
  achievements: 2000,
  employer: 120,
  employers: 8,
  resumeName: 200,
  resumeBytes: 2_097_152,
} as const;

export const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
export type StaffGender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<StaffGender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

export const MARITAL_STATUSES = ["single", "married", "widowed", "separated", "prefer_not_to_say"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_LABELS: Record<MaritalStatus, string> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  separated: "Separated",
  prefer_not_to_say: "Prefer not to say",
};

export const REGISTRATION_STATUSES = ["pending", "in_progress", "completed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export type StaffEmployer = { company: string; position: string; duration: string };

/** The sections the progress tracker reports. Resume is an alternative to typing education and experience. */
export const STAFF_SECTIONS = ["basic", "address", "contact", "education", "experience", "resume"] as const;
export type StaffSection = (typeof STAFF_SECTIONS)[number];

/** Inputs on the staff profile form that can show a field error (employers and the résumé report form-level). */
export type StaffDetailField = Exclude<keyof StaffDetails, "employers" | "resumeName">;

export type StaffDetails = {
  fullName: string;
  dateOfBirth: string;
  gender: StaffGender | "";
  nationality: string;
  maritalStatus: MaritalStatus | "";
  currentStreet: string;
  currentCity: string;
  currentProvince: string;
  currentPostalCode: string;
  permanentStreet: string;
  permanentCity: string;
  permanentProvince: string;
  permanentPostalCode: string;
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
    currentCity: "",
    currentProvince: "",
    currentPostalCode: "",
    permanentStreet: "",
    permanentCity: "",
    permanentProvince: "",
    permanentPostalCode: "",
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
    keyResponsibilities: "",
    achievements: "",
    resumeName: "",
  };
}

const filled = (value: string) => value.trim().length > 0;

/** Which sections have the details they need. Email is always present, so it is not a section by itself. */
export function staffSections(details: StaffDetails): Record<StaffSection, boolean> {
  const employer = details.employers.some((job) => filled(job.company) && filled(job.position));
  return {
    basic: filled(details.fullName) && filled(details.dateOfBirth) && details.gender !== "" && filled(details.nationality) && details.maritalStatus !== "",
    address:
      filled(details.currentStreet) &&
      filled(details.currentCity) &&
      filled(details.currentProvince) &&
      filled(details.currentPostalCode) &&
      filled(details.permanentStreet) &&
      filled(details.permanentCity) &&
      filled(details.permanentProvince) &&
      filled(details.permanentPostalCode),
    contact: filled(details.mobileNumber) && filled(details.emergencyName) && filled(details.emergencyRelationship) && filled(details.emergencyPhone),
    education: filled(details.highestEducation) && filled(details.skills) && filled(details.languages),
    experience: employer && filled(details.keyResponsibilities),
    resume: filled(details.resumeName),
  };
}

export const REGISTRATION_STEPS = [
  { id: "invitation", label: "Invitation sent" },
  { id: "basic", label: "Basic details" },
  { id: "address", label: "Address" },
  { id: "contact", label: "Contacts" },
  { id: "skills", label: "Skills/Resume" },
  { id: "completed", label: "Completed" },
] as const;

export type RegistrationStep = { id: (typeof REGISTRATION_STEPS)[number]["id"]; label: string; done: boolean; current: boolean };

/** Invitation is always done. Skills/Resume is done from typed skills or an uploaded résumé. */
export function registrationSteps(sections: Record<StaffSection, boolean>): RegistrationStep[] {
  const reached = [true, sections.basic, sections.address, sections.contact, sections.education || sections.resume];
  const flags = [...reached, reached.every(Boolean)];
  const open = flags.findIndex((done) => !done);
  const current = open === -1 ? flags.length - 1 : open;
  return REGISTRATION_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    done: flags[index],
    current: index === current,
  }));
}

/** Pending until a section is saved, completed once the person is described by hand or by a resume. */
export function registrationStatus(sections: Record<StaffSection, boolean>): RegistrationStatus {
  const described = sections.basic && sections.address && sections.contact && ((sections.education && sections.experience) || sections.resume);
  if (described) return "completed";
  if (STAFF_SECTIONS.some((section) => sections[section])) return "in_progress";
  return "pending";
}
