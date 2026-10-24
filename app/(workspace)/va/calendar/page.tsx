import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes } from "@/content/routes";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar" };

export default function VaCalendarPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaCalendar />
    </Suspense>
  );
}

async function VaCalendar() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  return <Workspace title="Calendar" />;
}
