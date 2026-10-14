"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { STAFF_LIMITS, type InviteField, type StaffDetailField } from "./contract";
import { getStaffProfile, getUser, saveStaffProfile } from "./dal";
import { deactivateStaff, inviteStaff as invite } from "./service";
import { parseEmployers, parseInvite, parseStaffDetails, parseStaffId, withEmployers } from "./validation";
import { parseResumeText, resumeText } from "./resume-text";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

export async function inviteStaff(formData: FormData): Promise<SubmitResult<InviteField>> {
  const admin = await requireRole(["admin"]);
  const parsed = parseInvite(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await invite(parsed.value, admin.id);
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

const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Saves the staff profile. A résumé fills any section the form left blank when the file has those headings. */
export async function saveStaffProfileForm(formData: FormData): Promise<SubmitResult<StaffDetailField>> {
  await requireRole(["admin"]);
  const parsedId = parseStaffId({ userId: formData.get("userId") });
  if (!parsedId.ok) return { ok: false, message: "That account couldn't be found." };

  const raw = formEntries(formData);
  delete raw.userId;
  delete raw.resume;
  delete raw.employerCompany;
  delete raw.employerPosition;
  delete raw.employerDuration;
  const parsed = parseStaffDetails(raw);
  if (!parsed.ok) return toSubmitResult(parsed);

  const jobs = parseEmployers(
    formData.getAll("employerCompany").map((value) => String(value)),
    formData.getAll("employerPosition").map((value) => String(value)),
    formData.getAll("employerDuration").map((value) => String(value)),
  );
  if (!jobs.ok) return { ok: false, message: jobs.message };

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

  try {
    await saveStaffProfile(user.id, user.createdAt, withEmployers(parsed.value, jobs.value, resumeName), resume);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Staff profile save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save the profile. Please try again." };
  }

  refresh();
  return { ok: true };
}
