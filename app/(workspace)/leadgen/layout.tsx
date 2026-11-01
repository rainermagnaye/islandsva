import { Suspense } from "react";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { CountBadge } from "@/components/ui/badge";
import { appRoutes, routes } from "@/content/routes";
import { countNewLeads } from "@/features/leads/dal";
import { getSessionUser, needsSecondFactor } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

/**
 * Lead Gen shell: the same menu frame as the other workspaces. Access is still checked by every page —
 * this layout never authorizes anything.
 */
export default function LeadgenLayout({ children }: LayoutProps<"/leadgen">) {
  return (
    <div className="grid min-h-[inherit] md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
      <WorkspaceNav
        label="Lead Gen"
        items={[
          { href: appRoutes.leadgen, label: "Dashboard", icon: "home", exact: true },
          { href: appRoutes.leadgenCalendar, label: "Calendar", icon: "calendar" },
          {
            href: appRoutes.leadgenLeads,
            label: "Leads",
            icon: "inbox",
            badge: (
              <Suspense>
                <NewLeadsBadge />
              </Suspense>
            ),
          },
          { href: appRoutes.leadgenClients, label: "Clients", icon: "briefcase" },
        ]}
        footer={{ href: routes.home, label: "View site", icon: "external" }}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** New leads this Lead Gen owns. Hidden when the count can't be read, so the menu still renders. */
async function NewLeadsBadge() {
  const user = await getSessionUser();
  if (!user?.roles.includes("closer") || needsSecondFactor(user)) return null;

  let count: number;
  try {
    count = await countNewLeads();
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("New-lead count failed", { service: error.service, error });
    return null;
  }
  return count > 0 ? <CountBadge count={count} label={count === 1 ? "1 new lead" : `${count} new leads`} /> : null;
}
