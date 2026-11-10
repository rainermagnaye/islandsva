import "server-only";
import { ROLES, type Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { EMPLOYEE_ROLES, type EmployeeReviewStatus, type UserSummary } from "./contract";
import { classifyInviteError } from "./invite-result";

/**
 * Everyone, newest first (at most `limit`). Read as the signed-in admin (not with the secret key), so the
 * database's own rule — admins with two-factor sign-in may read all profiles — is enforced a second time.
 */
export async function listUsers(limit = 500): Promise<UserSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, signed_in_at, created_at, roles!roles_user_id_fkey(role)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new UpstreamError("supabase", `Listing users failed: ${error.message}`, { cause: error });

  const extras = await employeeExtras(data.map((row) => row.id));
  return data.map((row) => toSummary(row, extras.get(row.id)));
}

/**
 * Employees only: anyone holding an employee role (EMPLOYEE_ROLES; a Super Admin also holds admin), whatever else
 * they hold. A client contact is a login for their company, not staff. Newest first, at most `limit`.
 * Filtered in the database so the limit counts staff, not client logins. Read as the signed-in admin (RLS).
 */
export async function listEmployees(limit = 500): Promise<UserSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, signed_in_at, created_at, roles!roles_user_id_fkey(role), employee:roles!roles_user_id_fkey!inner(role)")
    .in("employee.role", [...EMPLOYEE_ROLES])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new UpstreamError("supabase", `Listing employees failed: ${error.message}`, { cause: error });

  const extras = await employeeExtras(data.map((row) => row.id));
  // `employee` only filters the rows; toSummary reads the full role list from `roles`.
  return data.map((row) => toSummary(row, extras.get(row.id)));
}

/** How many employees there are, to tell when the Teams board isn't showing everyone. */
export async function countEmployees() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id, employee:roles!roles_user_id_fkey!inner(role)", { count: "exact", head: true })
    .in("employee.role", [...EMPLOYEE_ROLES]);
  if (error) throw new UpstreamError("supabase", `Counting employees failed: ${error.message}`, { cause: error });
  return count ?? 0;
}

const OVERVIEW_PAGE = 1000;

const OVERVIEW_PAGES = 20;

export type VaRosterEntry = {
  id: string;
  fullName: string;
  status: UserSummary["status"];
  roles: Role[];
  reviewStatus: EmployeeReviewStatus | null;
};

/** Every account that holds the VA role, oldest id first. The page decides who is open with `vaPortalOpen`. */
export async function listVaRoster(): Promise<VaRosterEntry[]> {
  const rows: VaRosterEntry[] = [];
  for (let page = 0; page < OVERVIEW_PAGES; page += 1) {
    const from = page * OVERVIEW_PAGE;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, status, roles!roles_user_id_fkey!inner(role)")
      .eq("roles.role", "va")
      .order("id")
      .range(from, from + OVERVIEW_PAGE - 1);
    if (error) throw new UpstreamError("supabase", `Reading the VA roster failed (${error.code})`);
    const extras = await employeeExtras(data.map((row) => row.id));
    rows.push(
      ...data.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        status: row.status,
        roles: row.roles.map((granted) => granted.role),
        reviewStatus: extras.get(row.id)?.reviewStatus ?? null,
      })),
    );
    if (data.length < OVERVIEW_PAGE) return rows;
  }
  throw new UpstreamError("supabase", "Reading the VA roster exceeded 20 pages");
}

/** A few accounts matching a name or email, newest first. Read as the signed-in admin, so RLS applies. */
export async function searchProfiles(search: string, limit: number) {
  const supabase = await createClient();
  const pattern = `%${search}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .or(`full_name.ilike."${pattern}",email.ilike."${pattern}"`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new UpstreamError("supabase", `Searching accounts failed: ${error.message}`, { cause: error });
  return data.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email }));
}

/** How many accounts the signed-in admin can see. Head-only count: no rows are transferred. */
export async function countUsers() {
  const supabase = await createClient();
  const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  if (error) throw new UpstreamError("supabase", `Counting users failed: ${error.message}`, { cause: error });
  return count ?? 0;
}

/** One profile, read as the signed-in admin so RLS applies. Unknown ids are null, not an error. */
export async function getUser(id: string): Promise<UserSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, signed_in_at, created_at, roles!roles_user_id_fkey(role)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading user ${id} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  const extras = await employeeExtras([data.id]);
  return toSummary(data, extras.get(data.id));
}

type EmployeeExtra = { phone: string | null; reviewStatus: EmployeeReviewStatus | null };

/** Phone and review state for these accounts. People without an employee profile are absent. */
async function employeeExtras(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, EmployeeExtra>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("employee_profiles").select("user_id, mobile_number, review_status").in("user_id", [...ids]);
  if (error) throw new UpstreamError("supabase", `Reading employee profiles failed: ${error.message}`, { cause: error });
  return new Map(data.map((row) => [row.user_id, { phone: row.mobile_number, reviewStatus: row.review_status }] as const));
}

function toSummary(row: {
  id: string;
  email: string;
  full_name: string;
  status: UserSummary["status"];
  signed_in_at: string | null;
  created_at: string;
  roles: { role: Role }[];
}, extra: EmployeeExtra | undefined): UserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: extra?.phone ?? null,
    roles: ROLES.filter((role) => row.roles.some((granted) => granted.role === role)),
    status: row.status,
    signedInAt: row.signed_in_at,
    reviewStatus: extra?.reviewStatus ?? null,
    createdAt: row.created_at,
  };
}

// Writes below use the secret key (they bypass RLS): callers must have checked the admin role first.

/** Which invite email wording a person gets: a client contact, or an employee (VA, Lead Gen, admin). */
export type InviteAudience = "client" | "staff";

/**
 * Creates the auth user and sends the invite email. `redirectTo` is where the link opens (the password
 * form). A URL the project has not allowed comes back as `redirect` so the caller can send the link to
 * the site address instead. `invite_for` picks the wording in supabase/templates/invite.html (one Supabase
 * invite template serves everyone); it is only email copy, never used for access.
 * For an account made by `createAuthUser` that has not accepted an invite yet, Supabase sends the invite to
 * that same account instead of creating one; an account that already accepted comes back as `exists`.
 */
export async function inviteAuthUser(email: string, fullName: string, audience: InviteAudience, redirectTo?: string) {
  const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, invite_for: audience },
    redirectTo,
  });
  if (error) {
    const reason = classifyInviteError(error, redirectTo !== undefined);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase-auth", `Invite failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, userId: data.user.id };
}

/**
 * Creates the auth user without sending any email (the profile row follows by trigger). The email stays
 * unconfirmed, there is no password, and the account is locked (banned): without the lock, whoever controls
 * the mailbox could reach the account through "forgot password" or a magic link before the invite is sent.
 * `setAuthUserLocked` lifts it when the invite goes out. Same metadata as an invite, so the later invite
 * email gets the right wording.
 */
export async function createAuthUser(email: string, fullName: string, audience: InviteAudience) {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    email_confirm: false,
    ban_duration: LOCKED_FOR,
    user_metadata: { full_name: fullName, invite_for: audience },
  });
  if (error) {
    const reason = classifyInviteError(error, false);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase-auth", `Creating user failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, userId: data.user.id };
}

/**
 * When the last invite email went to this account, or null if none was ever sent. Only Supabase Auth
 * records it, so this reads with the secret key: callers must have checked the admin role first.
 * Unknown ids are null.
 */
export async function getInvitedAt(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error) {
    if (error.status === 404) return null;
    throw new UpstreamError("supabase-auth", `Reading user ${userId} failed: ${error.message}`, { cause: error });
  }
  return data.user.invited_at ?? null;
}

/**
 * Whether any account already uses this email. Checked before a new invite, because Supabase reuses an
 * unaccepted account instead of failing, and the invite's rollback would then delete that account. Uses the
 * secret key so the check sees every account whoever invites (an admin, or a Lead Gen activating a client):
 * callers must have checked the role first. Returns only yes or no.
 */
export async function emailHasAccount(email: string) {
  const { count, error } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true }).eq("email", email.toLowerCase());
  if (error) throw new UpstreamError("supabase", `Checking for an existing account failed: ${error.message}`, { cause: error });
  return (count ?? 0) > 0;
}

/** A lock with no practical end (about 100 years); only `setAuthUserLocked(…, false)` lifts it. */
const LOCKED_FOR = "876000h";

/**
 * Locks or unlocks sign-in for an account made with Create. A locked account gets no session from a
 * password, reset link, magic link or refresh. Not used for Deactivate, which stays on profiles.status.
 */
export async function setAuthUserLocked(userId: string, locked: boolean) {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: locked ? LOCKED_FOR : "none" });
  if (error) throw new UpstreamError("supabase-auth", `${locked ? "Locking" : "Unlocking"} user ${userId} failed: ${error.message}`, { cause: error });
}

const AUTH_PAGE = 1000;

const AUTH_PAGES = 20;

/**
 * Which of these accounts were created without an invite and have never signed in (shown as "New").
 * Only Supabase Auth records invites, so this reads with the secret key: callers must have checked the
 * admin role first. One Auth call per 1,000 accounts.
 */
export async function listUninvitedIds(ids: readonly string[]): Promise<Set<string>> {
  const wanted = new Set(ids);
  const uninvited = new Set<string>();
  if (wanted.size === 0) return uninvited;
  const admin = createAdminClient();
  for (let page = 1; page <= AUTH_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE });
    if (error) throw new UpstreamError("supabase-auth", `Listing auth users failed: ${error.message}`, { cause: error });
    for (const user of data.users) {
      if (wanted.has(user.id) && !user.invited_at && !user.last_sign_in_at) uninvited.add(user.id);
    }
    if (data.users.length < AUTH_PAGE) return uninvited;
  }
  throw new UpstreamError("supabase-auth", "Listing auth users exceeded 20 pages");
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

/** Whether this employee created a client or was ever assigned to one (such an account can't be deleted). */
export async function employeeHasHistory(userId: string) {
  const supabase = await createClient();
  const [clients, assignments] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("created_by", userId),
    supabase.from("client_va_assignments").select("id", { count: "exact", head: true }).eq("va_id", userId),
  ]);
  if (clients.error) throw new UpstreamError("supabase", `Checking client history for ${userId} failed: ${clients.error.message}`, { cause: clients.error });
  if (assignments.error) throw new UpstreamError("supabase", `Checking assignment history for ${userId} failed: ${assignments.error.message}`, { cause: assignments.error });
  return (clients.count ?? 0) > 0 || (assignments.count ?? 0) > 0;
}

/** Changes the sign-in email. A trigger copies it onto the profile. */
export async function updateEmployeeEmail(userId: string, email: string) {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (!error) return { ok: true as const };
  if (error.code === "email_exists" || /already/i.test(error.message)) return { ok: false as const, reason: "exists" as const };
  throw new UpstreamError("supabase-auth", `Updating email ${userId} failed: ${error.message}`, { cause: error });
}

/** Grants a role (the invite trigger has already created the user's profile). */
export async function grantRole(userId: string, role: Role, assignedBy: string) {
  const { error } = await createAdminClient().from("roles").insert({ user_id: userId, role, assigned_by: assignedBy });
  if (error) throw new UpstreamError("supabase", `Granting ${role} failed: ${error.message}`, { cause: error });
}
