import "server-only";
import { ROLES, type Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { UserSummary } from "./contract";

/**
 * Everyone, newest first. Read as the signed-in admin (not with the secret key), so the database's own
 * rule — admins with two-factor sign-in may read all profiles — is enforced a second time.
 */
export async function listUsers(): Promise<UserSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, created_at, roles!roles_user_id_fkey(role)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new UpstreamError("supabase", `Listing users failed: ${error.message}`, { cause: error });

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roles: ROLES.filter((role) => row.roles.some((granted) => granted.role === role)),
    status: row.status,
    createdAt: row.created_at,
  }));
}

// Writes below use the secret key (they bypass RLS): callers must have checked the admin role first.

/** Creates the auth user and emails the "Invite user" template link (→ /auth/confirm?type=invite). */
export async function inviteAuthUser(email: string, fullName: string) {
  const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (error) {
    if (error.code === "email_exists") return { ok: false as const, reason: "exists" as const };
    throw new UpstreamError("supabase-auth", `Invite failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, userId: data.user.id };
}

export async function deleteAuthUser(userId: string) {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new UpstreamError("supabase-auth", `Deleting user ${userId} failed: ${error.message}`, { cause: error });
}

/** Grants a role (the invite trigger has already created the user's profile). */
export async function grantRole(userId: string, role: Role, assignedBy: string) {
  const { error } = await createAdminClient().from("roles").insert({ user_id: userId, role, assigned_by: assignedBy });
  if (error) throw new UpstreamError("supabase", `Granting ${role} failed: ${error.message}`, { cause: error });
}
