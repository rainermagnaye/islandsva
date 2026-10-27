import "server-only";
import { refresh } from "next/cache";
import { UpstreamError } from "@/lib/upstream-error";
import { emailField, FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { emptyEmployeeDetails, registrationStatus, REVIEW_SECTION_LABELS, REVIEW_SECTIONS, reviewSectionFilled, EMPLOYEE_LIMITS, USER_LIMITS, employeeSections, type ReviewSection, type EmployeeDetailField, type EmployeeDetails, type UserSummary } from "./contract";
import { updateEmployeeEmail } from "./dal";
import { getEmployeeProfile, saveEmployeeProfile, setEmployeeReview } from "./employee-dal";
import { submitEmployeeForReview } from "./service";
import { parseEmployers, parseReferences, parseEmployeeDetails, withEmployers } from "./validation";
import { parseResumeText, resumeText } from "./resume-text";

// The employee profile form, shared by the admin's and the VA's save actions in actions.ts (which check the
// role first). Not an action file, so it may export helpers.

export const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const SECTION_FIELDS = {
  basic: ["fullName", "dateOfBirth", "gender", "nationality", "maritalStatus"],
  address: ["currentStreet", "currentLine2", "currentCity", "currentProvince", "currentPostalCode", "currentCountry"],
  contact: ["mobileNumber", "alternatePhone", "emergencyName", "emergencyRelationship", "emergencyPhone"],
  skills: ["highestEducation", "certifications", "skills", "languages"],
  experience: ["keyResponsibilities", "achievements"],
} as const satisfies Record<ReviewSection, readonly (keyof EmployeeDetails)[]>;

/** Saves the posted sections and, for a VA, sends the profile on once every section is complete. */
export async function persistEmployeeForm(
  formData: FormData,
  user: UserSummary,
  options: { updateEmail: boolean; forReview: boolean; allowed: readonly ReviewSection[]; clearReturned?: boolean },
): Promise<SubmitResult<EmployeeDetailField | "email">> {
  const allowed = new Set(options.allowed);
  const posted = formEntries(formData);
  const emailValue = posted.email;
  const skillDraft = allowed.has("skills") && typeof posted.skillDraft === "string" ? posted.skillDraft.trim() : "";
  const resumeTitle = posted.resumeName;
  const current = await getEmployeeProfile(user.id);
  const base = current?.details ?? emptyEmployeeDetails(user.fullName);
  const raw: Record<string, unknown> = {
    fullName: base.fullName,
    dateOfBirth: base.dateOfBirth,
    gender: base.gender,
    nationality: base.nationality,
    maritalStatus: base.maritalStatus,
    currentStreet: base.currentStreet,
    currentLine2: base.currentLine2,
    currentCity: base.currentCity,
    currentProvince: base.currentProvince,
    currentPostalCode: base.currentPostalCode,
    currentCountry: base.currentCountry,
    mobileNumber: base.mobileNumber,
    alternatePhone: base.alternatePhone,
    emergencyName: base.emergencyName,
    emergencyRelationship: base.emergencyRelationship,
    emergencyPhone: base.emergencyPhone,
    highestEducation: base.highestEducation,
    certifications: base.certifications,
    skills: base.skills,
    languages: base.languages,
    keyResponsibilities: base.keyResponsibilities,
    achievements: base.achievements,
  };
  for (const section of allowed) {
    for (const field of SECTION_FIELDS[section]) raw[field] = posted[field] ?? "";
  }
  if (skillDraft) {
    const skills = typeof raw.skills === "string" ? raw.skills.trim() : "";
    raw.skills = skills ? `${skills}, ${skillDraft}` : skillDraft;
  }
  const parsed = parseEmployeeDetails(raw);
  if (!parsed.ok) return toSubmitResult(parsed);

  const jobs = allowed.has("experience")
    ? parseEmployers(
        formData.getAll("employerCompany").map((value) => String(value)),
        formData.getAll("employerPosition").map((value) => String(value)),
        formData.getAll("employerDuration").map((value) => String(value)),
      )
    : { ok: true as const, value: base.employers };
  if (!jobs.ok) return { ok: false, message: jobs.message };

  const people = allowed.has("experience")
    ? parseReferences(
        formData.getAll("referenceName").map((value) => String(value)),
        formData.getAll("referencePhone").map((value) => String(value)),
        formData.getAll("referenceRelationship").map((value) => String(value)),
        formData.getAll("referenceCompany").map((value) => String(value)),
        formData.getAll("referenceEmail").map((value) => String(value)),
      )
    : { ok: true as const, value: base.references };
  if (!people.ok) return { ok: false, message: people.message };

  const email = options.updateEmail ? emailField(USER_LIMITS.email).safeParse(emailValue) : { success: true as const, data: user.email };
  if (!email.success) return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "Enter an email address like name@company.com." } };
  let resumeName = current?.details.resumeName ?? "";
  let resume: { name: string; type: string; bytes: Uint8Array } | undefined;
  const file = allowed.has("skills") ? formData.get("resume") : null;
  if (file instanceof File && file.size > 0) {
    const type = RESUME_TYPES[file.type] ?? (file.name.toLowerCase().endsWith(".pdf") ? RESUME_TYPES["application/pdf"] : file.name.toLowerCase().endsWith(".docx") ? RESUME_TYPES["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] : "");
    if (!type) return { ok: false, message: "Upload a PDF or DOCX résumé." };
    if (file.size > EMPLOYEE_LIMITS.resumeBytes) return { ok: false, message: "Keep the résumé under 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = parseResumeText(resumeText(bytes, type));
    const typed = typeof resumeTitle === "string" ? resumeTitle : "";
    const extension = file.name.toLowerCase().endsWith(".docx") ? ".docx" : ".pdf";
    const stem = (typed || file.name).trim().replace(/[^\w.\- ()]+/g, "").replace(/\.[^.]+$/, "").trim() || "resume";
    resumeName = `${stem}${extension}`.slice(0, EMPLOYEE_LIMITS.resumeName);
    resume = { name: resumeName, type, bytes };
    (Object.keys(extracted) as (keyof typeof extracted)[]).forEach((key) => {
      if (!parsed.value[key] && extracted[key]) parsed.value[key] = extracted[key];
    });
  }

  let avatar: { type: string; bytes: Uint8Array } | undefined;
  const photo = formData.get("avatar");
  if (photo instanceof File && photo.size > 0) {
    if (!AVATAR_TYPES.has(photo.type)) return { ok: false, message: "Upload a JPEG, PNG or WebP picture." };
    if (photo.size > EMPLOYEE_LIMITS.avatarBytes) return { ok: false, message: "Keep the profile picture under 512 KB." };
    avatar = { type: photo.type, bytes: new Uint8Array(await photo.arrayBuffer()) };
  }

  const details = withEmployers(parsed.value, jobs.value, people.value, resumeName);
  try {
    await saveEmployeeProfile(user.id, user.createdAt, details, resume, avatar);
    if (options.updateEmail && email.data !== user.email) {
      const updated = await updateEmployeeEmail(user.id, email.data);
      if (!updated.ok) return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "That email already has an account." } };
    }
    const filled = employeeSections(details);
    let returned = current?.returnedSections ?? [];
    if (options.clearReturned && current?.reviewStatus === "pending" && returned.length > 0) {
      returned = returned.filter((item) => !reviewSectionFilled(filled, item));
      if (returned.length !== current.returnedSections.length) {
        await setEmployeeReview(user.id, "pending", returned, current.returnNote);
      }
    }
    if (options.forReview) {
      if (registrationStatus(filled) !== "completed" || returned.length > 0) {
        refresh();
        return { ok: false, message: unfinishedSections(filled) };
      }
      const sent = await submitEmployeeForReview(user.id);
      if (!sent.ok) return { ok: false, message: sent.message };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee profile save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the profile. Please try again." };
  }

  refresh();
  return { ok: true };
}

function unfinishedSections(sections: Parameters<typeof reviewSectionFilled>[0]) {
  const missing = REVIEW_SECTIONS.filter((section) => !reviewSectionFilled(sections, section)).map((section) => REVIEW_SECTION_LABELS[section]);
  if (missing.length === 0) return "Finish every section before sending this for review.";
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Finish ${list} before we can send this for review.`;
}
