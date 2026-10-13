import "server-only";
import { deleteAuthUser, grantRole, inviteAuthUser } from "./dal";
import type { InviteInput } from "./validation";

/**
 * Invites a staff member: creates the account (Supabase emails the invite link; a trigger creates the
 * profile), then grants the role. If granting fails, the new account is deleted again (cascading to its
 * profile) so nobody is left signed up without a role.
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
