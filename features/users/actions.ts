

"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { emptyEmployeeDetails, openReviewSections, REVIEW_SECTIONS, EMPLOYEE_LIMITS, employeeSections, type InviteField, type MyProfileField, type EmployeeDetailField } from "./contract";
import { getUser } from "./dal";
import { getEmployeeProfile, saveEmployeeProfile } from "./employee-dal";
import { confirmEmployeeProfile, deactivateEmployee, inviteEmployee as invite, removeEmployeeAccount, returnEmployeeProfile } from "./service";
import { parseInvite, parseMyProfile, parseReviewReturn, parseEmployeeId } from "./validation";
import { AVATAR_TYPES, persistEmployeeForm } from "./employee-form";

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

/** The address this invite was sent from, so the email link opens this same app. */
async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host || host.length > 255 || /[\s/@\\]/.test(host)) return null;
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}
