import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { appRoutes, routes } from "@/content/routes";
import { countNewLeads } from "@/features/leads/dal";
import { getSessionUser, needsSecondFactor } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { AdminNav } from "./_components/admin-nav";

/**
 * Admin shell: menu beside (or above, on small screens) the page. The menu is static, so it shows
 * instantly; only the new-lead badge reads the session. Access is still checked by every page and action —
 * this layout never authorizes anything.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="grid min-h-[inherit] lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AdminNav
        items={[
          { href: appRoutes.admin, label: "Overview", icon: "home", exact: true },
          {
            href: appRoutes.adminLeads,
            label: "Leads",
            icon: "inbox",
            badge: (
              <Suspense>
                <NewLeadsBadge />
              </Suspense>
            ),
          },
          { href: appRoutes.adminClients, label: "Clients", icon: "briefcase" },
          { href: appRoutes.adminUsers, label: "Team", icon: "users" },
        ]}
        footer={
          <Link href={routes.home} className="flex min-h-11 items-center gap-3 rounded-md px-3 type-label text-ink-muted no-underline hover:bg-action-ghost-hover">
            <Icon name="arrow-right" />
            View site
          </Link>
        }
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Count of leads waiting for a first reply. Shown only to admins who can read leads; never blocks the menu. */
async function NewLeadsBadge() {
  const user = await getSessionUser();
  if (!user?.roles.includes("admin") || needsSecondFactor(user)) return null;

  let count: number;
  try {
    count = await countNewLeads();
  } catch (error) {
    // A badge isn't worth failing the page over; the leads page reports the outage itself.
    if (!(error instanceof UpstreamError)) throw error;
    console.error("New-lead count failed", { service: error.service, error });
    return null;
  }
  if (count === 0) return null;

  return (
    <span className="min-w-6 rounded-pill bg-action-secondary px-2 text-center type-body-sm text-on-action-secondary">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> new</span>
    </span>
  );
}
