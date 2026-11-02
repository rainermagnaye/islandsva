import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { packages } from "@/content/packages";
import { adminClientHref, adminUserHref, appRoutes } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { AdminClientVa } from "@/features/clients/components/admin-client-va";
import { getClient } from "@/features/clients/dal";
import { parseClientId } from "@/features/clients/validation";
import { listClientTasks } from "@/features/tasks/dal";
import { getUser } from "@/features/users/dal";
import { employeeHasAvatar } from "@/features/users/employee-dal";
import { parseEmployeeId } from "@/features/users/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Virtual assistant" };

export default function AdminClientVaPage({ params }: PageProps<"/admin/clients/[id]/vas/[vaId]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientVa params={params} />
    </Suspense>
  );
}

async function ClientVa({ params }: Pick<PageProps<"/admin/clients/[id]/vas/[vaId]">, "params">) {
  await requireRole(["admin"]);
  const { id, vaId } = await params;
  if (!parseClientId({ clientId: id }).ok || !parseEmployeeId({ userId: vaId }).ok) notFound();
  const [client, assignments, tasks] = await Promise.all([getClient(id), listActiveAssignments(id), listClientTasks(id)]);
  const assignment = assignments.find((row) => row.vaId === vaId);
  if (!client || !assignment) notFound();
  // Secret key only to see whether a picture exists; bytes stay behind the avatar route, which checks access again.
  const [user, hasPhoto] = await Promise.all([getUser(vaId), employeeHasAvatar(vaId)]);
  const name = user?.fullName.trim() || assignment.vaName;
  const pkg = packages.find((item) => item.slug === client.packageCode);

  return (
    <Workspace
      compact
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Admin", href: appRoutes.admin },
            { label: "Clients", href: appRoutes.adminClients },
            { label: client.companyName, href: adminClientHref(client.id) },
            { label: "Assistants", href: `${adminClientHref(client.id)}?tab=assistants` },
            { label: name },
          ]}
        />
      }
    >
      <AdminClientVa
        name={name}
        email={user?.email ?? null}
        photoSrc={hasPhoto ? `${adminUserHref(vaId)}/avatar` : undefined}
        assignmentId={assignment.id}
        startedAt={assignment.startedAt}
        hoursPerWeek={client.hoursPerWeek}
        packageName={pkg?.name ?? null}
        tasks={tasks.filter((task) => task.vaId === vaId)}
      />
    </Workspace>
  );
}
