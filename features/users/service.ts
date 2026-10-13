import "server-only";
import { appRoutes } from "@/content/routes";
import { UpstreamError } from "@/lib/upstream-error";
import { deleteAuthUser, grantRole, inviteAuthUser, setAccountInactive } from "./dal";
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
 * Deletes a staff account (auth user, profile and roles). Refuses the caller's own account. A person
 * still tied to a client or assignment cannot be deleted; the database keeps that history.
 */
export async function removeStaff(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, message: "You can't remove your own account." };
  try {
    await deleteAuthUser(userId);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    const detail = error.message.toLowerCase();
    if (detail.includes("foreign key") || detail.includes("restrict") || detail.includes("database error deleting")) {
      return { ok: false as const, message: "This person is still linked to a client or assignment, so they can't be removed." };
    }
    throw error;
  }
  return { ok: true as const };
}
