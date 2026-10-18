import { Suspense } from "react";
import { CountBadge } from "@/components/ui/badge";
import { appRoutes, routes } from "@/content/routes";
import { countNewLeads } from "@/features/leads/dal";
import { getSessionUser, needsSecondFactor } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { AdminNav } from "./_components/admin-nav";

/**
 * Admin shell (the design system's DashboardShell): menu beside the page — a 76px icon rail from 768px,
 * the full 264px sidebar from 1024px — or above it on phones. The menu is static, so it shows
 * instantly; only the new-lead badge reads the session. Access is still checked by every page and
 * action — this layout never authorizes anything.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="grid min-h-[inherit] md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
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
        footer={{ href: routes.home, label: "View site", icon: "external" }}
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
  return count > 0 ? <CountBadge count={count} label={count === 1 ? "1 new lead" : `${count} new leads`} /> : null;
}
