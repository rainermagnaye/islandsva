"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { emailField, FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { emptyEmployeeDetails, openReviewSections, registrationStatus, REVIEW_SECTION_LABELS, REVIEW_SECTIONS, reviewSectionFilled, EMPLOYEE_LIMITS, USER_LIMITS, employeeSections, type InviteField, type MyProfileField, type ReviewSection, type EmployeeDetailField, type EmployeeDetails, type UserSummary } from "./contract";
import { getEmployeeProfile, getUser, saveEmployeeProfile, setEmployeeReview, updateEmployeeEmail } from "./dal";
import { confirmEmployeeProfile, deactivateEmployee, inviteEmployee as invite, removeEmployeeAccount, returnEmployeeProfile, submitEmployeeForReview } from "./service";
import { parseEmployers, parseInvite, parseMyProfile, parseReferences, parseReviewReturn, parseEmployeeDetails, parseEmployeeId, withEmployers } from "./validation";
import { parseResumeText, resumeText } from "./resume-text";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

export async function inviteEmployee(formData: FormData): Promise<SubmitResult<InviteField>> {
  const admin = await requireRole(["admin"]);
  const parsed = parseInvite(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const origin = await requestOrigin();
    if (!origin) return { ok: false, message: "We couldn't send the invitation. Please try again in a moment." };
    const result = await invite(parsed.value, admin.id, origin);
    if (!result.ok) {
      if (result.reason === "rate") {
        return { ok: false, message: "Too many invitation emails were sent. Wait a while, then try again." };
      }
      if (result.reason === "exists") {
        return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "That email already has an account." } };
      }
      return { ok: false, message: "We couldn't send the invitation. Please try again in a moment." };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee invite failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send the invitation. Please try again in a moment." };
  }

  refresh(); // re-render the user list in the same round trip
  return { ok: true };
}

/** Soft-deactivates an employee account. Their history stays; they can no longer sign in. */
export async function disableEmployee(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireRole(["admin"]);
  const parsed = parseEmployeeId({ userId });
  if (!parsed.ok) return { ok: false, message: "That account couldn't be found." };

  try {
    const result = await deactivateEmployee(parsed.value.userId, admin.id);
    if (!result.ok) return result;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee deactivation failed", { service: error.service, error });
    return { ok: false, message: "We couldn't disable that account. Please try again." };
  }

  refresh();
  return { ok: true };
}

/** Deletes an employee account that has no client or assignment history. */
export async function removeEmployee(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireRole(["admin"]);
  const parsed = parseEmployeeId({ userId });
  if (!parsed.ok) return { ok: false, message: "That account couldn't be found." };

  try {
    const result = await removeEmployeeAccount(parsed.value.userId, admin.id);
    if (!result.ok) return result;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee removal failed", { service: error.service, error });
    return { ok: false, message: "We couldn't delete that account. Please try again." };
  }

  refresh();
  return { ok: true };
}

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Saves the signed-in person's phone, time format and picture. Name and email stay as they are. */
export async function saveMyProfile(formData: FormData): Promise<SubmitResult<MyProfileField>> {
  const user = await requireRole(["admin", "va", "closer"]);
  const entries = formEntries(formData);
  delete entries.avatar;
  delete entries.email;
  const parsed = parseMyProfile(entries);
  if (!parsed.ok) return toSubmitResult(parsed);

  let avatar: { type: string; bytes: Uint8Array } | undefined;
  const photo = formData.get("avatar");
  if (photo instanceof File && photo.size > 0) {
    if (!AVATAR_TYPES.has(photo.type)) return { ok: false, message: "Upload a JPEG, PNG or WebP picture." };
    if (photo.size > EMPLOYEE_LIMITS.avatarBytes) return { ok: false, message: "Keep the profile picture under 512 KB." };
    avatar = { type: photo.type, bytes: new Uint8Array(await photo.arrayBuffer()) };
  }

  try {
    const account = await getUser(user.id);
    if (!account) return { ok: false, message: "That account couldn't be found." };
    const current = await getEmployeeProfile(user.id);
    const details = {
      ...(current?.details ?? emptyEmployeeDetails(account.fullName)),
      fullName: current?.details.fullName || account.fullName,
      mobileNumber: parsed.value.mobileNumber,
    };
    await saveEmployeeProfile(account.id, account.createdAt, details, undefined, avatar, parsed.value.timeFormat);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("My profile save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the profile. Please try again." };
  }

  refresh();
  return { ok: true };
}

const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Saves the employee profile. A résumé fills any section the form left blank when the file has those headings. */
export async function saveEmployeeProfileForm(formData: FormData): Promise<SubmitResult<EmployeeDetailField | "email">> {
  await requireRole(["admin"]);
  const parsedId = parseEmployeeId({ userId: formData.get("userId") });
  if (!parsedId.ok) return { ok: false, message: "That account couldn't be found." };
  const user = await getUser(parsedId.value.userId);
  if (!user) return { ok: false, message: "That account couldn't be found." };
  return persistEmployeeForm(formData, user, { updateEmail: true, forReview: false, allowed: REVIEW_SECTIONS });
}

/** Saves the VA's profile and sends it once every section is valid. */
export async function saveOwnEmployeeProfile(formData: FormData): Promise<SubmitResult<EmployeeDetailField | "email">> {
  const va = await requireRole(["va"]);
  try {
    const user = await getUser(va.id);
    if (!user || user.status === "inactive") return { ok: false, message: "That account couldn't be found." };
    const current = await getEmployeeProfile(va.id);
    if (current?.reviewStatus === "pending_review") return { ok: false, message: "This profile is already with the admin." };
    if (current?.reviewStatus === "approved") return { ok: false, message: "This profile is already confirmed." };
    const allowed = openReviewSections(current?.sections ?? employeeSections(emptyEmployeeDetails(user.fullName)), current?.returnedSections ?? []);
    return await persistEmployeeForm(formData, user, { updateEmail: false, forReview: true, allowed, clearReturned: true });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee profile save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the profile. Please try again." };
  }
}

/** Confirms a profile that is waiting for review and opens the VA portal. */
export async function confirmEmployee(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(["admin"]);
  const parsed = parseEmployeeId({ userId });
  if (!parsed.ok) return { ok: false, message: "That account couldn't be found." };
  try {
    const result = await confirmEmployeeProfile(parsed.value.userId);
    if (!result.ok) return result;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee confirmation failed", { service: error.service, error });
    return { ok: false, message: "We couldn't confirm that profile. Please try again." };
  }
  refresh();
  return { ok: true };
}

/** Sends a profile back to the sections that need a change. */
export async function returnEmployee(formData: FormData): Promise<SubmitResult<"note" | "sections">> {
  await requireRole(["admin"]);
  const parsed = parseReviewReturn({
    userId: formData.get("userId"),
    note: formData.get("note") ?? "",
    sections: formData.getAll("section").map(String),
  });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await returnEmployeeProfile(parsed.value.userId, parsed.value.sections, parsed.value.note);
    if (!result.ok) return { ok: false, message: result.message };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Employee return failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send that profile back. Please try again." };
  }
  refresh();
  return { ok: true };
}

const SECTION_FIELDS = {
  basic: ["fullName", "dateOfBirth", "gender", "nationality", "maritalStatus"],
  address: ["currentStreet", "currentLine2", "currentCity", "currentProvince", "currentPostalCode", "currentCountry"],
  contact: ["mobileNumber", "alternatePhone", "emergencyName", "emergencyRelationship", "emergencyPhone"],
  skills: ["highestEducation", "certifications", "skills", "languages"],
  experience: ["keyResponsibilities", "achievements"],
} as const satisfies Record<ReviewSection, readonly (keyof EmployeeDetails)[]>;

/** Saves the posted sections and, for a VA, sends the profile on once every section is complete. */
async function persistEmployeeForm(
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

/** The address this invite was sent from, so the email link opens this same app. */
async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host || host.length > 255 || /[\s/@\\]/.test(host)) return null;
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}
