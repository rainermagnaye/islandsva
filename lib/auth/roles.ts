// Role rules shared by the server (session checks) and the UI (nav). Pure functions — no secrets, no I/O.
import { appRoutes, type AppRoutePath } from "@/content/routes";
import type { Enums } from "@/types/database";

/** A role as stored in `roles.role` (the `app_role` enum) and copied into the access token. */
export type Role = Enums<"app_role">;

/** Every role, highest precedence first — decides which home a multi-role user lands on. */
export const ROLES = ["admin", "closer", "va", "client"] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", closer: "Closer", va: "VA", client: "Client" };

/** Closers share the admin workspace in the MVP (one person often holds both roles). */
export const ROLE_HOME: Record<Role, AppRoutePath> = {
  admin: appRoutes.admin,
  closer: appRoutes.admin,
  va: appRoutes.va,
  client: appRoutes.client,
};

/**
 * Roles from a verified access token. They are written only by our custom access token hook into
 * `app_metadata` (never `user_metadata`, which users can edit). Unknown values are dropped.
 */
export function rolesFromClaims(claims: { app_metadata?: { [key: string]: unknown } } | null | undefined): Role[] {
  const raw = claims?.app_metadata?.roles;
  if (!Array.isArray(raw)) return [];
  return ROLES.filter((role) => raw.includes(role));
}

/** Where a user lands after sign-in: their highest-precedence role's home, or null with no roles. */
export function homeFor(roles: readonly Role[]): AppRoutePath | null {
  const top = ROLES.find((role) => roles.includes(role));
  return top ? ROLE_HOME[top] : null;
}

/** Distinct workspaces a user can switch between, in precedence order (admin + closer share one). */
export function workspacesFor(roles: readonly Role[]): { role: Role; href: AppRoutePath }[] {
  const seen = new Set<AppRoutePath>();
  return ROLES.filter((role) => roles.includes(role))
    .map((role) => ({ role, href: ROLE_HOME[role] }))
    .filter(({ href }) => !seen.has(href) && seen.add(href));
}

/**
 * A post-login redirect target taken from the URL, accepted only if it is a same-site path.
 * Rejects absolute and protocol-relative URLs (`https://evil`, `//evil`, `/\evil`) — open-redirect defence.
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return /[\u0000-\u001f\u007f\\]/.test(value) ? fallback : value;
}
