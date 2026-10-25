import type { ReactNode } from "react";
import { appRoutes } from "@/content/routes";
import { WorkspaceNav } from "@/components/layout/workspace-nav";

/** The VA menu beside the page. Shared by the VA section and My Profile. */
export function VaShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[inherit] md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
      <WorkspaceNav
        label="VA"
        items={[
          { href: appRoutes.va, label: "Dashboard", icon: "home", exact: true },
          { href: appRoutes.vaClients, label: "Clients", icon: "briefcase" },
          { href: appRoutes.vaCalendar, label: "Calendar", icon: "calendar" },
        ]}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
