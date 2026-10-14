import "server-only";
import { deleteAuthUser, grantRole, inviteAuthUser, setAccountInactive } from "./dal";
import type { InviteInput } from "./validation";

/**
 * Invites a staff member: creates the account (Supabase emails the invite link; a trigger creates the
 * profile), then grants the role. If granting fails, the new account is deleted again (cascading to its
 * profile) so nobody is left signed up without a role.
 * The email's link comes from supabase/templates/invite.html: the Site URL's /auth/confirm, which signs
 * them in and opens the password form.
 */
export async function inviteStaff(input: InviteInput, invitedBy: string) {
  const invited = await inviteAuthUser(input.email, input.fullName);
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
