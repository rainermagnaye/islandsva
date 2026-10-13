import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { appRoutes } from "@/content/routes";
import { createClient } from "@/lib/supabase/server";
import { rolesFromClaims, type Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  roles: Role[];
  /** aal2 = signed in with a second factor (authenticator code) in this session. */
  aal: "aal1" | "aal2";
};

/**
 * The signed-in user for this request, or null. getClaims() verifies the access token's signature
 * (getSession() would trust the cookie as-is, so it is never used on the server). Deduplicated per request
 * with React cache, so layouts, pages and actions can all call it without extra round trips.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { claims } = data;
  return {
    id: claims.sub,
    email: claims.email ?? "",
    roles: rolesFromClaims(claims),
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/** Admins can read every user's data, so their whole workspace requires two-factor sign-in. */
export const needsSecondFactor = (user: SessionUser) => user.roles.includes("admin") && user.aal !== "aal2";

/** The signed-in user, or a redirect to sign-in. Use in every page and action that needs a session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(appRoutes.login);
  return user;
}

/**
 * The signed-in user holding one of `allowed`. Anyone else gets a 404 (not 403: don't confirm the page
 * exists); an admin who hasn't completed two-factor sign-in is sent to /mfa first. Call it in every page,
 * Server Action and data function of a role-restricted area — proxy.ts redirects are only a convenience.
 */
export async function requireRole(allowed: readonly Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (needsSecondFactor(user)) redirect(appRoutes.mfa);
  if (!user.roles.some((role) => allowed.includes(role))) notFound();
  return user;
}
