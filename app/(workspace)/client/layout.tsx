import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { appRoutes, routes } from "@/content/routes";

/** Client shell: the shared workspace menu beside the page. Access is still checked by every page — this layout never authorizes anything. */
export default function ClientLayout({ children }: LayoutProps<"/client">) {
  return (
    <div className="grid min-h-[inherit] md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
      <WorkspaceNav
        label="Client"
        items={[
          { href: appRoutes.client, label: "Dashboard", icon: "home", exact: true },
          { href: appRoutes.clientCalendar, label: "Calendar", icon: "calendar" },
          { href: appRoutes.clientAssistants, label: "My assistants", icon: "user" },
          { href: appRoutes.clientMatch, label: "VA Match", icon: "users" },
        ]}
        footer={{ href: routes.home, label: "View site", icon: "external" }}
      />
      <div className="client-workspace min-w-0 [&_.workspace-page]:gap-5 [&_.workspace-page]:px-5 [&_.workspace-page]:py-4 [&_.workspace-page]:md:px-6 [&_.workspace-page]:md:py-5">{children}</div>
    </div>
  );
}
