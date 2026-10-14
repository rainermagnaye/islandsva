import "server-only";
import { ROLES, type Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { Json } from "@/types/database";
import { registrationStatus, staffSections, type RegistrationStatus, type StaffDetails, type StaffEmployer, type StaffSection, type UserSummary } from "./contract";
import { classifyInviteError } from "./invite-result";

/**
 * Everyone, newest first (at most `limit`). Read as the signed-in admin (not with the secret key), so the
 * database's own rule — admins with two-factor sign-in may read all profiles — is enforced a second time.
 */
export async function listUsers(limit = 500): Promise<UserSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, created_at, roles!roles_user_id_fkey(role)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new UpstreamError("supabase", `Listing users failed: ${error.message}`, { cause: error });

  return data.map(toSummary);
}

/** One profile, read as the signed-in admin so RLS applies. Unknown ids are null, not an error. */
export async function getUser(id: string): Promise<UserSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, created_at, roles!roles_user_id_fkey(role)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading user ${id} failed: ${error.message}`, { cause: error });
  return data ? toSummary(data) : null;
}

function toSummary(row: {
  id: string;
  email: string;
  full_name: string;
  status: UserSummary["status"];
  created_at: string;
  roles: { role: Role }[];
}): UserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roles: ROLES.filter((role) => row.roles.some((granted) => granted.role === role)),
    status: row.status,
    createdAt: row.created_at,
  };
}

// Writes below use the secret key (they bypass RLS): callers must have checked the admin role first.

/**
 * Creates the auth user and sends the invite email. `redirectTo` is where the link opens (the password
 * form). A URL the project has not allowed comes back as `redirect` so the caller can send the link to
 * the site address instead.
 */
export async function inviteAuthUser(email: string, fullName: string, redirectTo?: string) {
  const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (error) {
    const reason = classifyInviteError(error, redirectTo !== undefined);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase-auth", `Invite failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, userId: data.user.id };
}

/** Soft deactivate. profiles has no update policy, so this uses the secret key after the admin check. */
export async function setAccountInactive(userId: string) {
  const { error } = await createAdminClient().from("profiles").update({ status: "inactive" }).eq("id", userId);
  if (error) throw new UpstreamError("supabase", `Deactivating ${userId} failed: ${error.message}`, { cause: error });
}

/**
 * Only to roll back an invite whose role grant failed (service.ts) — accounts are deactivated, never
 * deleted (CLAUDE.md §7).
 */
export async function deleteAuthUser(userId: string) {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new UpstreamError("supabase-auth", `Deleting user ${userId} failed: ${error.message}`, { cause: error });
}

const PROFILE_COLUMNS =
  "user_id, date_of_birth, gender, nationality, marital_status, current_street, current_city, current_province, current_postal_code, permanent_street, permanent_city, permanent_province, permanent_postal_code, mobile_number, alternate_phone, emergency_name, emergency_relationship, emergency_phone, highest_education, certifications, skills, languages, employers, key_responsibilities, achievements, resume_name, registration_status, invitation_sent_at, registration_completed_at";

export type StaffProfileRecord = {
  details: StaffDetails;
  registrationStatus: RegistrationStatus;
  invitationSentAt: string;
  registrationCompletedAt: string | null;
  sections: Record<StaffSection, boolean>;
};

/** The staff profile, read as the signed-in admin so RLS applies. Null when nobody has saved one yet. */
export async function getStaffProfile(userId: string): Promise<StaffProfileRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff_profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading staff profile ${userId} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  const details = detailsFrom(data);
  return {
    details,
    registrationStatus: data.registration_status,
    invitationSentAt: data.invitation_sent_at,
    registrationCompletedAt: data.registration_completed_at,
    sections: staffSections(details),
  };
}

/**
 * Saves the profile with the secret key. profiles has no update policy, and resume bytes are not granted
 * to the API, so this runs only after the caller has checked the admin role.
 */
export async function saveStaffProfile(userId: string, invitedAt: string, details: StaffDetails, resume?: { name: string; type: string; bytes: Uint8Array }) {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("staff_profiles")
    .select("invitation_sent_at, registration_completed_at, resume_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new UpstreamError("supabase", `Reading staff profile ${userId} failed: ${readError.message}`, { cause: readError });

  const sections = staffSections(details);
  const status = registrationStatus(sections);
  const completedAt = status === "completed" ? (existing?.registration_completed_at ?? new Date().toISOString()) : null;
  const blank = (value: string) => value.trim() || null;

  const { error: nameError } = await admin.from("profiles").update({ full_name: details.fullName }).eq("id", userId);
  if (nameError) throw new UpstreamError("supabase", `Updating name ${userId} failed: ${nameError.message}`, { cause: nameError });

  const row = {
    user_id: userId,
    date_of_birth: blank(details.dateOfBirth),
    gender: details.gender || null,
    nationality: blank(details.nationality),
    marital_status: details.maritalStatus || null,
    current_street: blank(details.currentStreet),
    current_city: blank(details.currentCity),
    current_province: blank(details.currentProvince),
    current_postal_code: blank(details.currentPostalCode),
    permanent_street: blank(details.permanentStreet),
    permanent_city: blank(details.permanentCity),
    permanent_province: blank(details.permanentProvince),
    permanent_postal_code: blank(details.permanentPostalCode),
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
    key_responsibilities: blank(details.keyResponsibilities),
    achievements: blank(details.achievements),
    resume_name: blank(details.resumeName),
    registration_status: status,
    invitation_sent_at: existing?.invitation_sent_at ?? invitedAt,
    registration_completed_at: completedAt,
    ...(resume
      ? { resume_type: resume.type, resume_bytes: `\\x${Buffer.from(resume.bytes).toString("hex")}` }
      : {}),
  };

  const { error } = await admin.from("staff_profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw new UpstreamError("supabase", `Saving staff profile ${userId} failed: ${error.message}`, { cause: error });
}

function detailsFrom(row: {
  date_of_birth: string | null;
  gender: StaffDetails["gender"] | null;
  nationality: string | null;
  marital_status: StaffDetails["maritalStatus"] | null;
  current_street: string | null;
  current_city: string | null;
  current_province: string | null;
  current_postal_code: string | null;
  permanent_street: string | null;
  permanent_city: string | null;
  permanent_province: string | null;
  permanent_postal_code: string | null;
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
  key_responsibilities: string | null;
  achievements: string | null;
  resume_name: string | null;
}): StaffDetails {
  return {
    fullName: "",
    dateOfBirth: row.date_of_birth ?? "",
    gender: row.gender ?? "",
    nationality: row.nationality ?? "",
    maritalStatus: row.marital_status ?? "",
    currentStreet: row.current_street ?? "",
    currentCity: row.current_city ?? "",
    currentProvince: row.current_province ?? "",
    currentPostalCode: row.current_postal_code ?? "",
    permanentStreet: row.permanent_street ?? "",
    permanentCity: row.permanent_city ?? "",
    permanentProvince: row.permanent_province ?? "",
    permanentPostalCode: row.permanent_postal_code ?? "",
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
    keyResponsibilities: row.key_responsibilities ?? "",
    achievements: row.achievements ?? "",
    resumeName: row.resume_name ?? "",
  };
}

function employersFrom(value: Json): StaffEmployer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json | undefined>;
    return [{ company: String(row.company ?? ""), position: String(row.position ?? ""), duration: String(row.duration ?? "") }];
  });
}

/** Grants a role (the invite trigger has already created the user's profile). */
export async function grantRole(userId: string, role: Role, assignedBy: string) {
  const { error } = await createAdminClient().from("roles").insert({ user_id: userId, role, assigned_by: assignedBy });
  if (error) throw new UpstreamError("supabase", `Granting ${role} failed: ${error.message}`, { cause: error });
}
