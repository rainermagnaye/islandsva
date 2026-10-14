import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { StaffProfile } from "@/features/users/components/staff-profile";
import { getStaffProfile, getUser, staffHasHistory } from "@/features/users/dal";
import { parseStaffId } from "@/features/users/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff" };

export default function StaffProfilePage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Staff params={params} />
    </Suspense>
  );
}

async function Staff({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const admin = await requireRole(["admin"]);
  const { id } = await params;
  if (!parseStaffId({ userId: id }).ok) notFound();
  const user = await getUser(id);
  if (!user) notFound();
  const [profile, hasHistory] = await Promise.all([getStaffProfile(user.id), staffHasHistory(user.id)]);

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
      <StaffProfile user={user} actorId={admin.id} profile={profile} hasHistory={hasHistory} />
    </Workspace>
  );
}
