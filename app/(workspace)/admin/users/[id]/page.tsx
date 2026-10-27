import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { EmployeeProfile } from "@/features/users/components/employee-profile";
import { getUser, employeeHasHistory } from "@/features/users/dal";
import { getEmployeeProfile } from "@/features/users/employee-dal";
import { parseEmployeeId } from "@/features/users/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Employee" };

export default function EmployeeProfilePage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Employee params={params} />
    </Suspense>
  );
}

async function Employee({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const admin = await requireRole(["admin"]);
  const { id } = await params;
  if (!parseEmployeeId({ userId: id }).ok) notFound();
  const user = await getUser(id);
  if (!user) notFound();
  const [profile, hasHistory] = await Promise.all([getEmployeeProfile(user.id), employeeHasHistory(user.id)]);

  const name = user.fullName || user.email;

  return (
    <Workspace
      compact
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Admin", href: appRoutes.admin },
            { label: "Teams", href: appRoutes.adminUsers },
            { label: name },
          ]}
        />
      }
    >
      <EmployeeProfile user={user} actorId={admin.id} profile={profile} hasHistory={hasHistory} />
    </Workspace>
  );
}
