import "server-only";
import { cache } from "react";
import { appRoutes } from "@/content/routes";
import { vaPortalOpen, type ReviewSection } from "./contract";
import { createLoginLink, createRecoveryLink, deleteAuthUser, getStaffProfile, getUser, grantRole, inviteAuthUser, setAccountInactive, setStaffReview, staffHasHistory } from "./dal";
import type { InviteInput } from "./validation";

/**
 * Invites a staff member: creates the account (Supabase emails the invite link; a trigger creates the
 * profile), then grants the role. If granting fails, the new account is deleted again (cascading to its
 * profile) so nobody is left signed up without a role.
 * The link should open the password form. If that address is not allowed yet, the invite is sent to the
 * site address instead — the same form still opens from the link.
 */
export async function inviteStaff(input: InviteInput, invitedBy: string, origin: string) {
  const redirectTo = `${origin}${appRoutes.acceptInvite}`;
  let invited = await inviteAuthUser(input.email, input.fullName, redirectTo);
  if (!invited.ok && invited.reason === "redirect") {
    invited = await inviteAuthUser(input.email, input.fullName);
  }
  if (!invited.ok) return invited;

  try {
    await grantRole(invited.userId, input.role, invitedBy);
  } catch (error) {
    await deleteAuthUser(invited.userId).catch((cleanupError: unknown) =>
      console.error("Orphaned invited user", { userId: invited.userId, cleanupError }),
    );
    throw error;
  }
  return { ok: true as const };
}

/** Marks the account inactive. The person keeps their history and loses portal access at the next sign-in. */
export async function deactivateStaff(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, message: "You can't disable your own account." };
  await setAccountInactive(userId);
  return { ok: true as const };
}

/**
 * Removes an account that has no client or assignment history. Anything else is deactivated instead,
 * so the record of who did the work stays resolvable.
 */
export async function removeStaff(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, message: "You can't delete your own account." };
  if (await staffHasHistory(userId)) return { ok: false as const, message: "This profile has history, so it can only be disabled." };
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
  const [account, profile] = await Promise.all([getUser(userId), getStaffProfile(userId)]);
  return { account, profile, open: account ? vaPortalOpen(account.status, profile?.reviewStatus ?? null) : false };
});

/** Sends a finished profile to the admin. The account stays invited. */
export async function submitStaffForReview(userId: string) {
  const profile = await getStaffProfile(userId);
  if (!profile || profile.reviewStatus === "approved") return { ok: false as const, message: "This profile is already confirmed." };
  if (profile.reviewStatus === "pending_review") return { ok: false as const, message: "This profile is already with the admin." };
  await setStaffReview(userId, "pending_review", [], null);
  return { ok: true as const };
}

/** Sends the profile back to the sections that need a change. */
export async function returnStaffProfile(userId: string, sections: readonly ReviewSection[], note: string) {
  const profile = await getStaffProfile(userId);
  if (!profile || profile.reviewStatus !== "pending_review") return { ok: false as const, message: "This profile isn't waiting for review." };
  await setStaffReview(userId, "pending", sections, note.trim() || null);
  return { ok: true as const };
}

/** Confirms the profile and opens the VA portal. */
export async function confirmStaffProfile(userId: string) {
  const [profile, user] = await Promise.all([getStaffProfile(userId), getUser(userId)]);
  if (!user || user.status === "inactive") return { ok: false as const, message: "This account is deactivated." };
  if (!profile || profile.reviewStatus !== "pending_review") return { ok: false as const, message: "This profile isn't waiting for review." };
  await setStaffReview(userId, "approved", [], null);
  return { ok: true as const };
}

/** For client activation (features/clients): a new login and the token hash for its first sign-in link. */
export async function createClientLogin(email: string, fullName: string) {
  return createLoginLink(email, fullName);
}

/** For resending a client's account email: a fresh sign-in link for their existing login. */
export async function clientSignInLink(email: string) {
  return createRecoveryLink(email);
}

/** Undoes createClientLogin when activation is refused, so no account is left without a client. */
export async function discardClientLogin(userId: string) {
  await deleteAuthUser(userId);
}
