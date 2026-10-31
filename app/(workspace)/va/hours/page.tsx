import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { HoursForm } from "@/features/matching/components/hours-form";
import { listWorkingHours } from "@/features/matching/dal";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Working hours" };

export default function VaHoursPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaHours />
    </Suspense>
  );
}

async function VaHours() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (!access.open) redirect(appRoutes.va);
  const windows = await listWorkingHours(user.id);

  return (
    <Workspace title="Working hours">
      <Panel title="Your week">
        <HoursForm windows={windows} />
      </Panel>
    </Workspace>
  );
}
