import type { Role } from "@/lib/auth/roles";
import { EMPLOYEE_ROLES, type AccountStatus } from "./contract";

export type InviteEligibility = "ok" | "missing" | "exists";

/**
 * Whether an admin may send (or resend) the invite email from an employee's profile. A client-only login is
 * invited from its company record, so it is `missing` here; a disabled or already signed-in account is `exists`.
 */
export function inviteEligibility(user: { roles: readonly Role[]; status: AccountStatus; signedInAt: string | null } | null): InviteEligibility {
  if (!user || !user.roles.some((role) => (EMPLOYEE_ROLES as readonly Role[]).includes(role))) return "missing";
  if (user.status === "inactive" || user.signedInAt !== null) return "exists";
  return "ok";
}
