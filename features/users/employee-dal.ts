import "server-only";
import { decodeBytea } from "@/lib/bytea";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { Json } from "@/types/database";
import { registrationStatus, reviewSections, employeeSections, type RegistrationStatus, type ReviewSection, type EmployeeDetails, type EmployeeEmployer, type EmployeeReference, type EmployeeReviewStatus, type EmployeeSection, type TimeFormat } from "./contract";

// The employee profile (employee_profiles): details, résumé, photo and review. Reads run as the signed-in
// user so RLS applies; the byte columns and review state aren't granted to the API, so those use the secret
// key after the caller's role check.

const PROFILE_COLUMNS =
  "user_id, date_of_birth, gender, nationality, marital_status, current_street, current_line2, current_city, current_province, current_postal_code, current_country, mobile_number, alternate_phone, emergency_name, emergency_relationship, emergency_phone, highest_education, certifications, skills, languages, employers, job_references, key_responsibilities, achievements, resume_name, resume_type, registration_status, review_status, returned_sections, return_note, invitation_sent_at, registration_completed_at, time_format";

export type EmployeeProfileRecord = {
  details: EmployeeDetails;
  resumeType: string | null;
  registrationStatus: RegistrationStatus;
  reviewStatus: EmployeeReviewStatus;
  returnedSections: ReviewSection[];
  returnNote: string | null;
  invitationSentAt: string;
  registrationCompletedAt: string | null;
  timeFormat: TimeFormat;
  sections: Record<EmployeeSection, boolean>;
};

/** The employee profile, read as the signed-in admin so RLS applies. Null when nobody has saved one yet. */
export async function getEmployeeProfile(userId: string): Promise<EmployeeProfileRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employee_profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading employee profile ${userId} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  const details = detailsFrom(data);
  return {
    details,
    resumeType: data.resume_type,
    registrationStatus: data.registration_status,
    reviewStatus: data.review_status,
    returnedSections: reviewSections(data.returned_sections ?? []),
    returnNote: data.return_note,
    invitationSentAt: data.invitation_sent_at,
    registrationCompletedAt: data.registration_completed_at,
    timeFormat: data.time_format === "24" ? "24" : "12",
    sections: employeeSections(details),
  };
}

/**
 * The résumé bytes are not granted to the API, so this read uses the secret key after the caller has
 * checked the admin role.
 */
export async function getEmployeeResume(userId: string): Promise<{ name: string; type: string; bytes: Uint8Array } | null> {
  const { data, error } = await createAdminClient().from("employee_profiles").select("resume_name, resume_type, resume_bytes").eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading résumé ${userId} failed: ${error.message}`, { cause: error });
  if (!data?.resume_name || !data.resume_type || !data.resume_bytes) return null;
  return { name: data.resume_name, type: data.resume_type, bytes: decodeBytea(data.resume_bytes) };
}

/**
 * Whether this person has a picture. The bytes are not granted to the API, so the header checks the type
 * column with the secret key after the caller has confirmed the id is the signed-in user.
 */
export async function employeeHasAvatar(userId: string) {
  const { data, error } = await createAdminClient().from("employee_profiles").select("avatar_type").eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading profile picture ${userId} failed: ${error.message}`, { cause: error });
  return Boolean(data?.avatar_type);
}

/** The picture bytes, with the secret key for the same reason as the résumé. */
export async function getEmployeeAvatar(userId: string): Promise<{ type: string; bytes: Uint8Array } | null> {
  const { data, error } = await createAdminClient().from("employee_profiles").select("avatar_type, avatar_bytes").eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading profile picture ${userId} failed: ${error.message}`, { cause: error });
  if (!data?.avatar_type || !data.avatar_bytes) return null;
  return { type: data.avatar_type, bytes: decodeBytea(data.avatar_bytes) };
}

/**
 * Saves the profile with the secret key. profiles has no update policy, and résumé bytes are not granted
 * to the API, so this runs only after the caller has checked the role.
 */
export async function saveEmployeeProfile(
  userId: string,
  invitedAt: string,
  details: EmployeeDetails,
  resume?: { name: string; type: string; bytes: Uint8Array },
  avatar?: { type: string; bytes: Uint8Array },
  timeFormat?: TimeFormat,
) {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("employee_profiles")
    .select("invitation_sent_at, registration_completed_at, resume_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new UpstreamError("supabase", `Reading employee profile ${userId} failed: ${readError.message}`, { cause: readError });

  const sections = employeeSections(details);
  const status = registrationStatus(sections);
  const completedAt = status === "completed" ? (existing?.registration_completed_at ?? new Date().toISOString()) : null;
  const blank = (value: string) => value.trim() || null;

  const row = {
    user_id: userId,
    date_of_birth: blank(details.dateOfBirth),
    gender: details.gender || null,
    nationality: blank(details.nationality),
    marital_status: details.maritalStatus || null,
    current_street: blank(details.currentStreet),
    current_line2: blank(details.currentLine2),
    current_city: blank(details.currentCity),
    current_province: blank(details.currentProvince),
    current_postal_code: blank(details.currentPostalCode),
    current_country: blank(details.currentCountry),
    mobile_number: blank(details.mobileNumber),
    alternate_phone: blank(details.alternatePhone),
    emergency_name: blank(details.emergencyName),
    emergency_relationship: blank(details.emergencyRelationship),
    emergency_phone: blank(details.emergencyPhone),
    highest_education: blank(details.highestEducation),
    certifications: blank(details.certifications),
    skills: blank(details.skills),
    languages: blank(details.languages),
    employers: details.employers,
    job_references: details.references,
    key_responsibilities: blank(details.keyResponsibilities),
    achievements: blank(details.achievements),
    resume_name: blank(details.resumeName),
    registration_status: status,
    invitation_sent_at: existing?.invitation_sent_at ?? invitedAt,
    registration_completed_at: completedAt,
    ...(resume
      ? { resume_type: resume.type, resume_bytes: `\\x${Buffer.from(resume.bytes).toString("hex")}` }
      : {}),
    ...(avatar
      ? { avatar_type: avatar.type, avatar_bytes: `\\x${Buffer.from(avatar.bytes).toString("hex")}` }
      : {}),
    ...(timeFormat ? { time_format: timeFormat } : {}),
  };

  // Profile first: it's the write that can fail (up to 2 MB of résumé, CHECK constraints). The name follows
  // only once that succeeded, so a failed save changes nothing; both writes are idempotent, so a retry
  // finishes the job. The name is written only when it actually changed.
  const { error } = await admin.from("employee_profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw new UpstreamError("supabase", `Saving employee profile ${userId} failed: ${error.message}`, { cause: error });

  const { error: nameError } = await admin.from("profiles").update({ full_name: details.fullName }).eq("id", userId).neq("full_name", details.fullName);
  if (nameError) throw new UpstreamError("supabase", `Updating name ${userId} failed: ${nameError.message}`, { cause: nameError });
}

/**
 * Review state is not granted to the API. The caller has already checked the role.
 * Confirming also activates the account, which profiles does not let the signed-in user set.
 */
export async function setEmployeeReview(userId: string, review: EmployeeReviewStatus, returned: readonly ReviewSection[], note: string | null) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("employee_profiles")
    .update({ review_status: review, returned_sections: [...returned], return_note: note })
    .eq("user_id", userId);
  if (error) throw new UpstreamError("supabase", `Updating review for ${userId} failed: ${error.message}`, { cause: error });
  if (review !== "approved") return;
  const { error: statusError } = await admin.from("profiles").update({ status: "active" }).eq("id", userId).neq("status", "inactive");
  if (statusError) throw new UpstreamError("supabase", `Activating ${userId} failed: ${statusError.message}`, { cause: statusError });
}

function detailsFrom(row: {
  date_of_birth: string | null;
  gender: EmployeeDetails["gender"] | null;
  nationality: string | null;
  marital_status: EmployeeDetails["maritalStatus"] | null;
  current_street: string | null;
  current_line2: string | null;
  current_city: string | null;
  current_province: string | null;
  current_postal_code: string | null;
  current_country: string | null;
  mobile_number: string | null;
  alternate_phone: string | null;
  emergency_name: string | null;
  emergency_relationship: string | null;
  emergency_phone: string | null;
  highest_education: string | null;
  certifications: string | null;
  skills: string | null;
  languages: string | null;
  employers: Json;
  job_references: Json;
  key_responsibilities: string | null;
  achievements: string | null;
  resume_name: string | null;
}): EmployeeDetails {
  return {
    fullName: "",
    dateOfBirth: row.date_of_birth ?? "",
    gender: row.gender ?? "",
    nationality: row.nationality ?? "",
    maritalStatus: row.marital_status ?? "",
    currentStreet: row.current_street ?? "",
    currentLine2: row.current_line2 ?? "",
    currentCity: row.current_city ?? "",
    currentProvince: row.current_province ?? "",
    currentPostalCode: row.current_postal_code ?? "",
    currentCountry: row.current_country ?? "",
    mobileNumber: row.mobile_number ?? "",
    alternatePhone: row.alternate_phone ?? "",
    emergencyName: row.emergency_name ?? "",
    emergencyRelationship: row.emergency_relationship ?? "",
    emergencyPhone: row.emergency_phone ?? "",
    highestEducation: row.highest_education ?? "",
    certifications: row.certifications ?? "",
    skills: row.skills ?? "",
    languages: row.languages ?? "",
    employers: employersFrom(row.employers),
    references: referencesFrom(row.job_references),
    keyResponsibilities: row.key_responsibilities ?? "",
    achievements: row.achievements ?? "",
    resumeName: row.resume_name ?? "",
  };
}

function referencesFrom(value: Json): EmployeeReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json | undefined>;
    return [{
      name: String(row.name ?? ""),
      phone: String(row.phone ?? ""),
      relationship: String(row.relationship ?? ""),
      company: String(row.company ?? ""),
      email: String(row.email ?? ""),
    }];
  });
}

function employersFrom(value: Json): EmployeeEmployer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json | undefined>;
    return [{ company: String(row.company ?? ""), position: String(row.position ?? ""), duration: String(row.duration ?? "") }];
  });
}
