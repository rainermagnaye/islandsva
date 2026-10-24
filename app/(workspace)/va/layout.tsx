import { Suspense, type ReactNode } from "react";
import { appRoutes } from "@/content/routes";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "../admin/_components/admin-nav";

/**
 * VA shell. The menu appears only after an admin confirms the profile. Until then the page is the form.
 * Access is still checked by every page — this layout never authorizes anything.
 */
export default function VaLayout({ children }: LayoutProps<"/va">) {
  return (
    <Suspense fallback={children}>
      <VaShell>{children}</VaShell>
    </Suspense>
  );
}

async function VaShell({ children }: { children: ReactNode }) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) return children;

  return (
    <div className="grid min-h-[inherit] md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
      <AdminNav
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
