// Values the staff profile form needs in the browser. Kept apart from contract.ts so the form's bundle
// (first load of /va) doesn't carry the rest of it; contract.ts re-exports all of these.

export const USER_LIMITS = { fullName: 120, email: 254 } as const;

export const STAFF_LIMITS = {
  nationality: 80,
  street: 160,
  city: 80,
  province: 80,
  postalCode: 20,
  country: 80,
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
  references: 3,
  resumeName: 200,
  resumeBytes: 2_097_152,
  avatarBytes: 524_288,
  returnNote: 500,
} as const;

export const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
export type StaffGender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<StaffGender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Other",
  prefer_not_to_say: "Prefer not to say",
};

/** The choices the profile form offers. Stored values stay on the existing gender set. */
export const GENDER_CHOICES = ["male", "female", "non_binary"] as const satisfies readonly StaffGender[];

export const MARITAL_STATUSES = ["single", "married", "widowed", "divorced", "separated", "prefer_not_to_say"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_LABELS: Record<MaritalStatus, string> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  divorced: "Divorced",
  separated: "Separated",
  prefer_not_to_say: "Prefer not to say",
};

/** The choices the profile form offers. Older rows may still be Separated or Prefer not to say. */
export const MARITAL_CHOICES = ["single", "married", "widowed", "divorced"] as const satisfies readonly MaritalStatus[];

export const REGISTRATION_STATUSES = ["pending", "in_progress", "completed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

/** Sections an admin can send back. Skills covers education and the résumé; experiences covers the reference. */
export const REVIEW_SECTIONS = ["basic", "address", "contact", "skills", "experience"] as const;
export type ReviewSection = (typeof REVIEW_SECTIONS)[number];
