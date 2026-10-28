import type { Role } from "@/lib/auth/roles";

/** Whose records the header search looks through. Admin wins over the other roles a person may also hold. */
export type SearchScope = "admin" | "closer" | "va" | "client";

/**
 * The scope for a signed-in user, or null when search has nothing for them: no role, or an admin who hasn't
 * finished two-factor sign-in (the admin lists need it, and they're sent to /mfa anyway).
 */
export function searchScopeFor(user: { roles: readonly Role[]; aal: "aal1" | "aal2" }): SearchScope | null {
  const { roles } = user;
  if (roles.includes("admin") || roles.includes("super_admin")) return user.aal === "aal2" ? "admin" : null;
  if (roles.includes("closer")) return "closer";
  if (roles.includes("va")) return "va";
  if (roles.includes("client")) return "client";
  return null;
}
