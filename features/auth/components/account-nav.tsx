import Link from "next/link";
import { adminUserHref, appRoutes } from "@/content/routes";
import { homeFor, ROLE_LABELS, workspacesFor } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { ownProfileHasAvatar } from "@/features/users/service";
import { getOwnProfileName } from "../dal";
import { AccountMenus } from "./account-menus";

/** Header controls: workspace links, notifications, then the profile menu. */
export async function AccountNav() {
  const user = await getSessionUser();
  if (!user) return null;
  const workspaces = workspacesFor(user.roles);
  let name = "";
  let hasPhoto = false;
  try {
    name = (await getOwnProfileName(user.id)) ?? "";
    hasPhoto = await ownProfileHasAvatar(user.id);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Profile name failed", { service: error.service, error });
  }
  const isEmployee = user.roles.some((role) => role === "admin" || role === "va" || role === "closer");
  const profileHref = isEmployee ? appRoutes.profile : (homeFor(user.roles) ?? appRoutes.dashboard);

  return (
    <div className="flex items-center gap-2">
      {workspaces.length > 1 && (
        <nav aria-label="Workspaces">
          <ul className="m-0 flex list-none gap-1 p-0">
            {workspaces.map(({ role, href }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-md px-3 type-label text-ink no-underline hover:bg-action-ghost-hover">
                  {ROLE_LABELS[role]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <AccountMenus
        name={name}
        email={user.email}
        profileHref={profileHref}
        photoSrc={hasPhoto ? `${adminUserHref(user.id)}/avatar` : undefined}
        showSettings={user.roles.includes("admin")}
        settingsHref={appRoutes.adminSettings}
      />
    </div>
  );
}
