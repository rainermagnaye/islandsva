import Link from "next/link";
import { ROLE_LABELS, workspacesFor } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { SignOutButton } from "./sign-out-button";

/** Header controls for the portal: a link per workspace the user can enter, their email, sign out. */
export async function AccountNav() {
  const user = await getSessionUser();
  if (!user) return null;
  const workspaces = workspacesFor(user.roles);

  return (
    <div className="flex items-center gap-2 sm:gap-4">
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
      <span className="hidden type-body-sm text-ink-muted md:inline">{user.email}</span>
      <SignOutButton />
    </div>
  );
}
