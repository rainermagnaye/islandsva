import "server-only";
import { cache } from "react";
import { appRoutes } from "@/content/routes";
import type { Role } from "@/lib/auth/roles";
import { vaPortalOpen, type ReviewSection } from "./contract";
import { inviteEligibility } from "./invite-eligibility";
import { createAuthUser, deleteAuthUser, emailHasAccount, getInvitedAt, getUser, setAuthUserLocked, grantRole, inviteAuthUser, listUsers, type InviteAudience, searchProfiles, setAccountInactive, employeeHasHistory } from "./dal";
import { getEmployeeProfile, setEmployeeReview, employeeHasAvatar } from "./employee-dal";
import type { InviteInput } from "./validation";

/**
 * Creates the account and grants the role. If granting fails, the new account is deleted again
 * (cascading to its profile) so nobody is left signed up without a role.
 * The link should open the password form. If that address is not allowed yet, the invite is sent to the
 * site address instead — the same form still opens from the link.
 */
async function inviteWithRole(email: string, fullName: string, role: Role, invitedBy: string, origin: string) {
  // An existing account (for example one made with Create) is invited from its own profile instead.
  if (await emailHasAccount(email)) return { ok: false as const, reason: "exists" as const };
  const invited = await sendInvite(email, fullName, role === "client" ? "client" : "staff", origin);
  if (!invited.ok) return invited;
  await grantOrRollback(invited.userId, role, invitedBy);
  return { ok: true as const, userId: invited.userId };
}

/** Grants the role to a new account, or deletes the account again if that fails. */
async function grantOrRollback(userId: string, role: Role, grantedBy: string) {
  try {
    await grantRole(userId, role, grantedBy);
  } catch (error) {
    await deleteAuthUser(userId).catch((cleanupError: unknown) =>
      console.error("Orphaned invited user", { userId, cleanupError }),
    );
    throw error;
  }
}

/** Sends the invite email; if the link address is not allowed yet, sends it with the site address instead. */
async function sendInvite(email: string, fullName: string, audience: InviteAudience, origin: string) {
  const invited = await inviteAuthUser(email, fullName, audience, `${origin}${appRoutes.acceptInvite}`);
  if (!invited.ok && invited.reason === "redirect") return inviteAuthUser(email, fullName, audience);
  return invited;
}

/** Invites an employee. */
export async function inviteEmployee(input: InviteInput, invitedBy: string, origin: string) {
  const invited = await inviteWithRole(input.email, input.fullName, input.role, invitedBy, origin);
  if (!invited.ok) return invited;
  return { ok: true as const };
}

/**
 * Creates an employee's account and profile without emailing them. The account can't sign in until the
 * invite is sent later from their profile (see createAuthUser).
 */
export async function createEmployee(input: InviteInput, createdBy: string) {
  const created = await createAuthUser(input.email, input.fullName, "staff");
  if (!created.ok) return created;
  await grantOrRollback(created.userId, input.role, createdBy);
  return { ok: true as const, userId: created.userId };
}

/**
 * Sends (or sends again) the invite email to an employee who has not signed in yet. Clients are invited
 * from their company record, and a disabled or signed-in account needs no invite.
 */
export async function sendEmployeeInvitation(userId: string, origin: string) {
  const user = await getUser(userId);
  const eligibility = inviteEligibility(user);
  if (!user || eligibility !== "ok") return { ok: false as const, reason: eligibility === "ok" ? ("missing" as const) : eligibility };

  // A profile made with Create is locked until its first invite. Every send unlocks first (a locked account
  // can't use the link), which also repairs a lock left by an earlier failed send. If this send fails, the
  // account is locked again only while no invite has ever gone out.
  await setAuthUserLocked(user.id, false);
  let invited: Awaited<ReturnType<typeof sendInvite>>;
  try {
    invited = await sendInvite(user.email, user.fullName, "staff", origin);
  } catch (error) {
    await relockIfNeverInvited(user.id);
    throw error;
  }
  if (!invited.ok) {
    await relockIfNeverInvited(user.id);
    return invited;
  }
  return { ok: true as const };
}

/**
 * Locks the account again after a failed send, unless an invite has gone out (read now, not before the send,
 * so a second admin's send that succeeded at the same moment isn't locked out). Failures here are logged;
 * the send error is what the admin sees.
 */
async function relockIfNeverInvited(userId: string) {
  try {
    if ((await getInvitedAt(userId)) === null) await setAuthUserLocked(userId, true);
  } catch (lockError) {
    console.error("Account left unlocked after a failed invite", { userId, lockError });
  }
}

/** Invites the client contact and grants the client role. The caller links the login to the company. */
export function inviteClient(email: string, fullName: string, invitedBy: string, origin: string) {
  return inviteWithRole(email, fullName, "client", invitedBy, origin);
}

/** Deletes an invite whose later step failed. Accounts are otherwise deactivated, never deleted. */
export function rollbackInvite(userId: string) {
  return deleteAuthUser(userId);
}

/** Marks the account inactive. The person keeps their history and loses portal access at the next sign-in. */
export async function deactivateEmployee(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, message: "You can't disable your own account." };
  await setAccountInactive(userId);
  return { ok: true as const };
}

/**
 * Removes an account that has no client or assignment history. Anything else is deactivated instead,
 * so the record of who did the work stays resolvable.
 */
export async function removeEmployeeAccount(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, message: "You can't delete your own account." };
  if (await employeeHasHistory(userId)) return { ok: false as const, message: "This profile has history, so it can only be disabled." };
  try {
    await deleteAuthUser(userId);
  } catch (error) {
    if (error instanceof Error && /restrict|foreign key|database error deleting/i.test(error.message)) {
      return { ok: false as const, message: "This profile has history, so it can only be disabled." };
    }
    throw error;
  }
  return { ok: true as const };
}

/** The signed-in VA's gate, once per request. The layout and the page both ask. */
export const loadVaAccess = cache(async (userId: string) => {
  const [account, profile] = await Promise.all([getUser(userId), getEmployeeProfile(userId)]);
  return { account, profile, open: account ? vaPortalOpen(account.status, profile?.reviewStatus ?? null) : false };
});

/** Sends a finished profile to the admin. The account stays invited. */
export async function submitEmployeeForReview(userId: string) {
  const profile = await getEmployeeProfile(userId);
  if (!profile || profile.reviewStatus === "approved") return { ok: false as const, message: "This profile is already confirmed." };
  if (profile.reviewStatus === "pending_review") return { ok: false as const, message: "This profile is already with the admin." };
  await setEmployeeReview(userId, "pending_review", [], null);
  return { ok: true as const };
}

/** Sends the profile back to the sections that need a change. */
export async function returnEmployeeProfile(userId: string, sections: readonly ReviewSection[], note: string) {
  const profile = await getEmployeeProfile(userId);
  if (!profile || profile.reviewStatus !== "pending_review") return { ok: false as const, message: "This profile isn't waiting for review." };
  await setEmployeeReview(userId, "pending", sections, note.trim() || null);
  return { ok: true as const };
}

/** Confirms the profile and opens the VA portal. */
export async function confirmEmployeeProfile(userId: string) {
  const [profile, user] = await Promise.all([getEmployeeProfile(userId), getUser(userId)]);
  if (!user || user.status === "inactive") return { ok: false as const, message: "This account is deactivated." };
  if (!profile || profile.reviewStatus !== "pending_review") return { ok: false as const, message: "This profile isn't waiting for review." };
  await setEmployeeReview(userId, "approved", [], null);
  return { ok: true as const };
}

/** Name and email matches for the header search. */
export async function findEmployee(search: string, limit: number) {
  return searchProfiles(search, limit);
}

/** The signed-in person is asking whether their own picture is saved. */
export function ownProfileHasAvatar(userId: string) {
  return employeeHasAvatar(userId);
}

/** For assigning a VA to a client (features/clients): VAs whose account is active and profile approved. Read as the admin (RLS). */
export async function listAssignableVas() {
  const users = await listUsers();
  return users
    .filter((user) => user.roles.includes("va") && vaPortalOpen(user.status, user.reviewStatus))
    .map((user) => ({ id: user.id, fullName: user.fullName || user.email, email: user.email }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
