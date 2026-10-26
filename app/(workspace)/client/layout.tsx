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
          { href: appRoutes.clientMatch, label: "VA Match", icon: "users" },
          { href: appRoutes.clientTasks, label: "Tasks", icon: "check" },
        ]}
        footer={{ href: routes.home, label: "View site", icon: "external" }}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
