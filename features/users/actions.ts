"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { emailField, FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { STAFF_LIMITS, USER_LIMITS, type InviteField, type StaffDetailField } from "./contract";
import { getStaffProfile, getUser, saveStaffProfile, updateStaffEmail } from "./dal";
import { splitAddress } from "./profile-fields";
import { deactivateStaff, inviteStaff as invite, removeStaff } from "./service";
import { parseEmployers, parseInvite, parseStaffDetails, parseStaffId, withEmployers } from "./validation";
import { parseResumeText, resumeText } from "./resume-text";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

export async function inviteStaff(formData: FormData): Promise<SubmitResult<InviteField>> {
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
    console.error("Staff invite failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send the invitation. Please try again in a moment." };
  }

  refresh(); // re-render the user list in the same round trip
  return { ok: true };
}

/** Soft-deactivates a staff account. Their history stays; they can no longer sign in. */
export async function disableStaffMember(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireRole(["admin"]);
  const parsed = parseStaffId({ userId });
  if (!parsed.ok) return { ok: false, message: "That account couldn't be found." };

  try {
    const result = await deactivateStaff(parsed.value.userId, admin.id);
    if (!result.ok) return result;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Staff deactivation failed", { service: error.service, error });
    return { ok: false, message: "We couldn't disable that account. Please try again." };
  }

  refresh();
  return { ok: true };
}

/** Deletes a staff account that has no client or assignment history. */
export async function removeStaffMember(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireRole(["admin"]);
  const parsed = parseStaffId({ userId });
  if (!parsed.ok) return { ok: false, message: "That account couldn't be found." };

  try {
    const result = await removeStaff(parsed.value.userId, admin.id);
    if (!result.ok) return result;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Staff removal failed", { service: error.service, error });
    return { ok: false, message: "We couldn't delete that account. Please try again." };
  }

  refresh();
  return { ok: true };
}

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Saves the staff profile. A résumé fills any section the form left blank when the file has those headings. */
export async function saveStaffProfileForm(formData: FormData): Promise<SubmitResult<StaffDetailField | "email">> {
  await requireRole(["admin"]);
  const parsedId = parseStaffId({ userId: formData.get("userId") });
  if (!parsedId.ok) return { ok: false, message: "That account couldn't be found." };

  const raw = formEntries(formData);
  const emailValue = raw.email;
  const skillDraft = typeof raw.skillDraft === "string" ? raw.skillDraft.trim() : "";
  delete raw.userId;
  delete raw.resume;
  delete raw.avatar;
  delete raw.email;
  delete raw.skillDraft;
  delete raw.employerCompany;
  delete raw.employerPosition;
  delete raw.employerDuration;
  for (const key of Object.keys(raw)) {
    if (key.startsWith("durationStart-") || key.startsWith("durationEnd-")) delete raw[key];
  }
  if (skillDraft) {
    const skills = typeof raw.skills === "string" ? raw.skills.trim() : "";
    raw.skills = skills ? `${skills}, ${skillDraft}` : skillDraft;
  }
  applyAddress(raw, "current");
  applyAddress(raw, "permanent");
  const parsed = parseStaffDetails(raw);
  if (!parsed.ok) return toSubmitResult(parsed);

  const jobs = parseEmployers(
    formData.getAll("employerCompany").map((value) => String(value)),
    formData.getAll("employerPosition").map((value) => String(value)),
    formData.getAll("employerDuration").map((value) => String(value)),
  );
  if (!jobs.ok) return { ok: false, message: jobs.message };

  const email = emailField(USER_LIMITS.email).safeParse(emailValue);
  if (!email.success) return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "Enter an email address like name@company.com." } };

  const user = await getUser(parsedId.value.userId);
  if (!user) return { ok: false, message: "That account couldn't be found." };
  const current = await getStaffProfile(user.id);
  let resumeName = current?.details.resumeName ?? "";
  let resume: { name: string; type: string; bytes: Uint8Array } | undefined;
  const file = formData.get("resume");
  if (file instanceof File && file.size > 0) {
    const type = RESUME_TYPES[file.type] ?? (file.name.toLowerCase().endsWith(".pdf") ? RESUME_TYPES["application/pdf"] : file.name.toLowerCase().endsWith(".docx") ? RESUME_TYPES["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] : "");
    if (!type) return { ok: false, message: "Upload a PDF or DOCX résumé." };
    if (file.size > STAFF_LIMITS.resumeBytes) return { ok: false, message: "Keep the résumé under 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = parseResumeText(resumeText(bytes, type));
    resumeName = file.name.slice(0, STAFF_LIMITS.resumeName);
    resume = { name: resumeName, type, bytes };
    (Object.keys(extracted) as (keyof typeof extracted)[]).forEach((key) => {
      if (!parsed.value[key] && extracted[key]) parsed.value[key] = extracted[key];
    });
  }

  let avatar: { type: string; bytes: Uint8Array } | undefined;
  const photo = formData.get("avatar");
  if (photo instanceof File && photo.size > 0) {
    if (!AVATAR_TYPES.has(photo.type)) return { ok: false, message: "Upload a JPEG, PNG or WebP picture." };
    if (photo.size > STAFF_LIMITS.avatarBytes) return { ok: false, message: "Keep the profile picture under 512 KB." };
    avatar = { type: photo.type, bytes: new Uint8Array(await photo.arrayBuffer()) };
  }

  try {
    await saveStaffProfile(user.id, user.createdAt, withEmployers(parsed.value, jobs.value, resumeName), resume, avatar);
    if (email.data !== user.email) {
      const updated = await updateStaffEmail(user.id, email.data);
      if (!updated.ok) return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "That email already has an account." } };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Staff profile save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the profile. Please try again." };
  }

  refresh();
  return { ok: true };
}

/** The address textarea holds every line. Each line is stored in its own column. */
function applyAddress(raw: Record<string, unknown>, prefix: "current" | "permanent") {
  const street = raw[`${prefix}Street`];
  const text = typeof street === "string" ? street : "";
  const parts = splitAddress(text);
  raw[`${prefix}Street`] = parts.street;
  raw[`${prefix}City`] = parts.city;
  raw[`${prefix}Province`] = parts.province;
  raw[`${prefix}PostalCode`] = parts.postal;
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
