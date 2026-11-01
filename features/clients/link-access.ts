import type { Role } from "@/lib/auth/roles";

/**
 * Whether this user may see or create a client's registration link (no sign-in; it opens the client's details,
 * agreement and payment proof). Lead Gens can read every client in their agency, so the link stays with the Lead Gen
 * who created the client; admins see every link.
 */
export function canSeeRegistrationLink(user: { id: string; roles: readonly Role[] }, client: { createdById: string }) {
  return user.roles.includes("admin") || client.createdById === user.id;
}
