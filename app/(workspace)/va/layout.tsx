import { Suspense, type ReactNode } from "react";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { VaShell } from "./_components/va-shell";

/**
 * VA shell. The menu appears only after an admin confirms the profile. Until then the page is the form.
 * Access is still checked by every page — this layout never authorizes anything.
 */
export default function VaLayout({ children }: LayoutProps<"/va">) {
  return (
    <Suspense fallback={children}>
      <VaFrame>{children}</VaFrame>
    </Suspense>
  );
}

async function VaFrame({ children }: { children: ReactNode }) {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) return children;
  return <VaShell>{children}</VaShell>;
}
